import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  isModified: boolean;
  type?: "text" | "number";
  align?: "left" | "right";
  disabled?: boolean;
}

export default function EditableCell({
  value,
  onChange,
  isModified,
  type = "text",
  align = "left",
  disabled = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === value) return;
    if (type === "number" && trimmed !== "" && isNaN(Number(trimmed))) {
      setDraft(value);
      return;
    }
    onChange(trimmed);
  };

  if (disabled) {
    return (
      <span className={cn("text-sm", align === "right" && "text-right block")}>
        {type === "number" && value ? `$${value}` : value || "—"}
      </span>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        type="text"
        inputMode={type === "number" ? "decimal" : "text"}
        className={cn(
          "h-7 px-1.5 text-sm min-w-[80px]",
          align === "right" && "text-right",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "w-full text-sm px-1.5 py-0.5 rounded cursor-pointer text-left transition-colors",
        "hover:bg-muted/50 hover:ring-1 hover:ring-ring/20",
        align === "right" && "text-right",
        isModified && "bg-yellow-100 dark:bg-yellow-900/30 ring-1 ring-yellow-400/50",
      )}
    >
      {type === "number" && value ? `$${value}` : value || "—"}
    </button>
  );
}
