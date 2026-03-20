import { useState } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatPanel } from "./ChatPanel";

export function ChatBubble() {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl">
            <ChatPanel onClose={() => setOpen(false)} className="h-full rounded-none border-0 shadow-none" />
          </SheetContent>
        </Sheet>
      )}

      {!isMobile && open && (
        <div className="fixed z-50 bottom-6 right-6 w-[400px] h-[560px]">
          <ChatPanel onClose={() => setOpen(false)} className="h-full" />
        </div>
      )}

      {!open && (
        <Button
          onClick={() => setOpen(true)}
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
