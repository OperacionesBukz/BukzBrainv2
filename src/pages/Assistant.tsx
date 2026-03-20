import { useState } from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ChatPanel } from "@/components/agent/ChatPanel";
import { useAgentChat } from "@/lib/agent/use-agent-chat";

const Assistant = () => {
  const { isAdmin } = useAuth();
  const { conversations, conversationId, selectConversation, startNewConversation, deleteConversation } = useAgentChat();
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
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center rounded-lg transition-colors overflow-hidden",
                    conv.id === conversationId
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <button
                    onClick={() => selectConversation(conv.id)}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm min-w-0 overflow-hidden"
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    title="Eliminar conversación"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
