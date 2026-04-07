import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { SlashCommandDef } from "@/lib/agent/slash-commands";

interface SlashCommandMenuProps {
  commands: SlashCommandDef[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommandDef) => void;
  visible: boolean;
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  visible,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!visible || commands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50"
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Comandos rapidos
        </div>
        {commands.map((cmd, i) => (
          <button
            key={cmd.name}
            ref={(el) => { itemRefs.current[i] = el; }}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
              i === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground hover:bg-accent/50",
            )}
            onClick={() => onSelect(cmd)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="text-base leading-none mt-0.5 shrink-0">{cmd.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-medium text-xs">/{cmd.name}</span>
                <span className="text-xs text-muted-foreground truncate">{cmd.args}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
