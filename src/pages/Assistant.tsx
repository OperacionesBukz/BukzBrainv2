import { useState } from "react";
import { Plus, MessageSquare, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/agent/ChatPanel";
import { useAgentChat } from "@/lib/agent/use-agent-chat";

const Assistant = () => {
  const { isAdmin } = useAuth();
  const { conversations, conversationId, selectConversation, startNewConversation } = useAgentChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        No tienes acceso a esta página.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {sidebarOpen && (
        <div className="w-64 shrink-0 border border-border rounded-xl bg-muted/20 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Conversaciones</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startNewConversation()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
                    conv.id === conversationId
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3 w-3 inline mr-2" />
                  {conv.title}
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                  Sin conversaciones aún
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <ChatPanel
          onClose={() => setSidebarOpen(!sidebarOpen)}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default Assistant;
