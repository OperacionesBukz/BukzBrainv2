import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Square, Bot, Maximize2, Minimize2, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { useAgentChat } from "@/lib/agent/use-agent-chat";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { parseSlashCommand, filterCommands, type SlashCommandDef } from "@/lib/agent/slash-commands";
import { executeCommand } from "@/lib/agent/command-handlers";

interface ChatPanelProps {
  onClose: () => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  className?: string;
}

export function ChatPanel({ onClose, onExpand, onMinimize, className }: ChatPanelProps) {
  const {
    messages, loading, error, rateLimited,
    sendMessage, addLocalMessage, cancelRequest,
  } = useAgentChat();
  const { user } = useAuth();

  const [input, setInput] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredCommands = useMemo(() => filterCommands(input), [input]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, commandLoading]);

  // Show/hide menu based on input
  useEffect(() => {
    if (input.startsWith("/") && !input.includes(" ")) {
      setMenuVisible(true);
      setMenuIndex(0);
    } else {
      setMenuVisible(false);
    }
  }, [input]);

  const handleSelectCommand = useCallback((cmd: SlashCommandDef) => {
    const needsArgs = cmd.args !== "Sin argumentos";
    setInput(`/${cmd.name}${needsArgs ? " " : ""}`);
    setMenuVisible(false);
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || commandLoading) return;

    // Check if it's a slash command
    const parsed = parseSlashCommand(trimmed);
    if (parsed) {
      setInput("");
      setCommandLoading(true);
      try {
        // Add user message locally and get the conversation ID
        const convId = await addLocalMessage("user", trimmed);
        // Execute command
        const result = await executeCommand(parsed.name, parsed.args, user?.uid ?? "");
        // Add result as assistant message in the SAME conversation
        await addLocalMessage("assistant", result.content, convId);
      } catch {
        await addLocalMessage("assistant", "**Error:** No se pudo ejecutar el comando.");
      } finally {
        setCommandLoading(false);
      }
      return;
    }

    // Normal LLM message
    sendMessage(trimmed);
    setInput("");
  }, [input, loading, commandLoading, addLocalMessage, sendMessage, user]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (menuVisible && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenuIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !input.includes(" "))) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[menuIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuVisible(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [menuVisible, filteredCommands, menuIndex, input, handleSelectCommand, handleSend]);

  const isLoading = loading || commandLoading;

  return (
    <div className={cn(
      "flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden",
      className
    )}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1">BukzBrain Assistant</span>
        {onMinimize ? (
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={onMinimize}
            title="Minimizar"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onExpand ? onExpand() : (() => { onClose(); navigate("/assistant"); })()}
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={onClose}
          title="Cerrar"
        >
          <span className="text-lg leading-none">&times;</span>
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-8">
            <Bot className="h-8 w-8 text-primary/50" />
            <p>Escribe <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">/</code> para ver comandos rapidos</p>
            <p className="text-xs text-muted-foreground/60">o escribe tu pregunta para el asistente IA</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
              {commandLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 animate-pulse text-primary" />
                  Ejecutando comando...
                </span>
              ) : (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-1.5 text-xs text-destructive flex items-center gap-1 bg-destructive/5">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="p-2 border-t border-border">
        {rateLimited && (
          <p className="text-xs text-amber-500 mb-1 px-1">Espera unos segundos antes de enviar otro mensaje</p>
        )}
        <div className="relative">
          <SlashCommandMenu
            commands={filteredCommands}
            selectedIndex={menuIndex}
            onSelect={handleSelectCommand}
            visible={menuVisible}
          />
          <div className="flex gap-1.5">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (input.startsWith("/") && !input.includes(" ")) {
                  setMenuVisible(true);
                }
              }}
              onBlur={() => {
                // Small delay to allow click on menu items
                setTimeout(() => setMenuVisible(false), 150);
              }}
              placeholder="Escribe / para comandos o tu mensaje..."
              disabled={rateLimited}
              className="text-sm h-9"
            />
            {isLoading ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={cancelRequest}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="default" size="icon" className="h-9 w-9 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || rateLimited}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
