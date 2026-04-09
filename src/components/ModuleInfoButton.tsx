import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ModuleInfoContent } from "@/lib/module-info";

interface ModuleInfoButtonProps {
  content: ModuleInfoContent;
}

export function ModuleInfoButton({ content }: ModuleInfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Informacion del modulo"
      >
        <Info className="h-[18px] w-[18px]" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{content.title}</DialogTitle>
            <DialogDescription>{content.what}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Funcionalidades
              </h4>
              <ul className="space-y-1.5">
                {content.features.map((feature, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {content.tips && content.tips.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  Tips
                </h4>
                <ul className="space-y-1.5">
                  {content.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
