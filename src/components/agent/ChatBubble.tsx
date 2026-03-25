import { useState } from "react";
import { Bot, Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAgentPermissions } from "@/hooks/use-agent-permissions";
import { ChatPanel } from "./ChatPanel";
import { useAgentChat } from "@/lib/agent/use-agent-chat";

type BubbleMode = "closed" | "mini" | "expanded";

export function ChatBubble() {
  const { hasAgentAccess, loading: agentLoading } = useAgentPermissions();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<BubbleMode>("closed");
  const {
    conversations, conversationId,
    selectConversation, startNewConversation, deleteConversation,
  } = useAgentChat();

  if (agentLoading || !hasAgentAccess) return null;

  return (
    <>
      {/* Mobile: Sheet bottom */}
      {isMobile && mode !== "closed" && (
        <Sheet open onOpenChange={(open) => !open && setMode("closed")}>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
            <ChatPanel
              onClose={() => setMode("closed")}
              className="h-full rounded-none border-0 shadow-none"
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop: Mini popup */}
      {!isMobile && mode === "mini" && (
        <div className="fixed z-50 bottom-6 right-6 w-[400px] h-[560px]">
          <ChatPanel
            onClose={() => setMode("closed")}
            onExpand={() => setMode("expanded")}
            className="h-full"
          />
        </div>
      )}

      {/* Desktop: Expanded popup con sidebar */}
      {!isMobile && mode === "expanded" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMode("mini");
          }}
        >
          <div className="w-[90vw] max-w-5xl h-[85vh] flex gap-0 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Sidebar de conversaciones */}
            <div className="w-64 shrink-0 border-r border-border bg-muted/20 flex flex-col">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold">Conversaciones</span>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => startNewConversation()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "group relative flex items-center rounded-lg transition-colors",
                        conv.id === conversationId
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <button
                        onClick={() => selectConversation(conv.id)}
                        className="w-full text-left px-3 py-2 pr-8 text-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3 w-3 shrink-0" />
                          <span className="block truncate">{conv.title}</span>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
              </div>
            </div>

            {/* Chat panel */}
            <div className="flex-1 min-w-0">
              <ChatPanel
                onClose={() => setMode("closed")}
                onMinimize={() => setMode("mini")}
                className="h-full rounded-none border-0 shadow-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      {mode === "closed" && (
        <Button
          onClick={() => setMode("mini")}
          className={cn(
            "fixed z-50 h-12 w-12 rounded-full shadow-lg",
            "bottom-36 right-4 md:bottom-6 md:right-6",
            "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          title="BukzBrain Assistant"
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
