import { useState, useRef, useEffect } from "react";
import { Send, Square, Bot, Maximize2, Minimize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { useAgentChat } from "@/lib/agent/use-agent-chat";
import { useNavigate } from "react-router-dom";

interface ChatPanelProps {
  onClose: () => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  className?: string;
}

export function ChatPanel({ onClose, onExpand, onMinimize, className }: ChatPanelProps) {
  const {
    messages, loading, error, rateLimited,
    sendMessage, cancelRequest,
  } = useAgentChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-8">
            <Bot className="h-8 w-8 text-primary/50" />
            <p>¡Hola! ¿En qué puedo ayudarte?</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
              </span>
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
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            disabled={rateLimited}
            className="text-sm h-9"
          />
          {loading ? (
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
  );
}
