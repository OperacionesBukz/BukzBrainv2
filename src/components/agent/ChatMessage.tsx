import { cn } from "@/lib/utils";
import { ToolChip } from "./ToolChip";
import type { AgentMessage } from "@/lib/agent/types";

interface ChatMessageProps {
  message: AgentMessage;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`list-${listKey++}`} className="my-1 ml-4 space-y-0.5 list-disc">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length < 2) {
      tableRows = [];
      return;
    }
    const headers = tableRows[0];
    // Skip separator row (index 1)
    const dataRows = tableRows.slice(2);

    result.push(
      <div key={`table-${tableKey++}`} className="my-2 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              {headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {formatInline(h.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1 whitespace-nowrap">
                    {formatInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  const formatInline = (line: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Match **bold**, *italic*, `code`, and plain text
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={match.index}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(
          <code key={match.index} className="px-1 py-0.5 rounded bg-background/50 text-xs font-mono">
            {match[4]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [line];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table row detection (starts and ends with |, or separator like |---|)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      const cells = trimmed.slice(1, -1).split("|");
      tableRows.push(cells);
      continue;
    }

    // If we were building a table and this line is not a table row, flush it
    if (tableRows.length > 0) {
      flushTable();
    }

    // List items (- or * at start)
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(<li key={`li-${i}`}>{formatInline(listMatch[1])}</li>);
      continue;
    }

    flushList();

    // Headers
    if (trimmed.startsWith("### ")) {
      result.push(<p key={i} className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mt-2 mb-0.5">{formatInline(trimmed.slice(4))}</p>);
    } else if (trimmed.startsWith("## ")) {
      result.push(<p key={i} className="font-semibold mt-2 mb-0.5">{formatInline(trimmed.slice(3))}</p>);
    } else if (trimmed === "") {
      result.push(<div key={i} className="h-1.5" />);
    } else {
      result.push(<p key={i}>{formatInline(trimmed)}</p>);
    }
  }

  // Flush any remaining
  if (tableRows.length > 0) flushTable();
  flushList();

  return result;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isCommand = isUser && message.content.startsWith("/");

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? isCommand
              ? "bg-primary/80 text-primary-foreground rounded-br-sm font-mono text-xs"
              : "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {message.toolCalls.map((tc, i) => (
              <ToolChip key={i} toolCall={tc} />
            ))}
          </div>
        )}
        {isUser ? message.content : renderMarkdown(message.content)}
      </div>
    </div>
  );
}
