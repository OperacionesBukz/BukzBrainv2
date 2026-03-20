// src/lib/agent/use-agent-chat.ts
import { useState, useCallback, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where, serverTimestamp, limit as firestoreLimit
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentContext } from "@/contexts/AgentContext";
import { sendToLLM } from "./llm-router";
import { getToolsForModule } from "./tool-registry";
import { buildSystemPrompt } from "./system-prompt";
import { RateLimiter } from "./rate-limiter";
import type { AgentMessage, AgentConversation, ToolCallResult } from "./types";

const rateLimiter = new RateLimiter(20, 60_000);
const MAX_CONTEXT_MESSAGES = 30;

interface AgentChatState {
  messages: AgentMessage[];
  conversations: AgentConversation[];
  conversationId: string | null;
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => Promise<string | undefined>;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  cancelRequest: () => void;
}

const AgentChatCtx = createContext<AgentChatState | null>(null);

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const { currentModule } = useAgentContext();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversations list — filtered at Firestore level for privacy
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "agent_conversations"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc"),
      firestoreLimit(50)
    );
    return onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgentConversation)));
    });
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    const q = query(
      collection(db, "agent_conversations", conversationId, "messages"),
      orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgentMessage)));
    });
  }, [conversationId]);

  const startNewConversation = useCallback(async () => {
    if (!user) return;
    const ref = await addDoc(collection(db, "agent_conversations"), {
      userId: user.uid,
      title: "Nueva conversación",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setConversationId(ref.id);
    setMessages([]);
    return ref.id;
  }, [user]);

  const selectConversation = useCallback((id: string) => {
    setConversationId(id);
    setError(null);
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    // Delete all messages in subcollection first
    const msgsSnap = await getDocs(collection(db, "agent_conversations", id, "messages"));
    const deletePromises = msgsSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
    // Delete the conversation doc
    await deleteDoc(doc(db, "agent_conversations", id));
    // If we deleted the active conversation, clear it
    if (conversationId === id) {
      setConversationId(null);
      setMessages([]);
    }
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !content.trim()) return;
    if (!rateLimiter.canSend()) {
      setRateLimited(true);
      setTimeout(() => setRateLimited(false), 5_000);
      return;
    }

    setError(null);
    setLoading(true);
    rateLimiter.record();

    // Create AbortController for this request
    const controller = new AbortController();
    abortRef.current = controller;

    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = (await startNewConversation()) ?? null;
      if (!activeConvId) { setLoading(false); return; }
    }

    // Save user message
    await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
      role: "user",
      content,
      timestamp: serverTimestamp(),
    });

    // Update conversation title if first message
    if (messages.length === 0) {
      await updateDoc(doc(db, "agent_conversations", activeConvId), {
        title: content.slice(0, 50),
        updatedAt: serverTimestamp(),
      });
    }

    // Build LLM messages
    const tools = getToolsForModule(currentModule);
    const systemPrompt = buildSystemPrompt({
      userName: user.displayName ?? user.email?.split("@")[0] ?? "Usuario",
      userEmail: user.email ?? "",
      userRole: role ?? "user",
      currentModule,
      tools,
    });

    const llmMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add recent messages as context
    const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
    for (const msg of recentMessages) {
      llmMessages.push({ role: msg.role, content: msg.content });
    }
    llmMessages.push({ role: "user", content });

    try {
      // Tool execution loop (max 5 iterations to prevent infinite loops)
      let iteration = 0;
      let response = await sendToLLM(llmMessages, tools);

      while (response.toolCalls.length > 0 && iteration < 5) {
        if (controller.signal.aborted) break;
        iteration++;
        const results: ToolCallResult[] = [];

        for (const tc of response.toolCalls) {
          const tool = tools.find((t) => t.name === tc.name);
          if (!tool) {
            results.push({ ...tc, result: { success: false, error: `Tool ${tc.name} no encontrada` } });
            continue;
          }
          const result = await tool.execute(tc.params, user.uid);
          results.push({ ...tc, result });
        }

        // Send tool results back to LLM
        llmMessages.push({
          role: "assistant",
          content: response.message || `Ejecutando: ${response.toolCalls.map((t) => t.name).join(", ")}`,
        });
        llmMessages.push({
          role: "user",
          content: `Resultados de herramientas:\n${JSON.stringify(results.map((r) => ({ tool: r.name, result: r.result })), null, 2)}`,
        });

        response = await sendToLLM(llmMessages, tools);

        // Save final response with tool call info
        if (response.toolCalls.length === 0) {
          await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
            role: "assistant",
            content: response.message,
            toolCalls: results,
            timestamp: serverTimestamp(),
          });
        }
      }

      // If no tool calls, save response directly
      if (iteration === 0) {
        await addDoc(collection(db, "agent_conversations", activeConvId, "messages"), {
          role: "assistant",
          content: response.message,
          timestamp: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, "agent_conversations", activeConvId), {
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [user, role, conversationId, messages, currentModule, startNewConversation]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  return (
    <AgentChatCtx.Provider value={{
      messages, conversations, conversationId, loading, error, rateLimited,
      sendMessage, startNewConversation, selectConversation, deleteConversation, cancelRequest,
    }}>
      {children}
    </AgentChatCtx.Provider>
  );
}

export function useAgentChat(): AgentChatState {
  const ctx = useContext(AgentChatCtx);
  if (!ctx) throw new Error("useAgentChat must be used within AgentChatProvider");
  return ctx;
}
