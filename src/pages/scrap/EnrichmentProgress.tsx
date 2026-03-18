import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JobStatus } from "./types";

interface EnrichmentProgressProps {
  jobStatus: JobStatus;
}

function LogIcon({ type }: { type: string }) {
  if (type === "ok") return <span className="text-green-500">●</span>;
  if (type === "parcial") return <span className="text-yellow-500">●</span>;
  return <span className="text-red-500">●</span>;
}

export default function EnrichmentProgress({ jobStatus }: EnrichmentProgressProps) {
  const pct = jobStatus.total > 0
    ? Math.round((jobStatus.processed / jobStatus.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {jobStatus.status === "processing" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Procesando ISBNs — {jobStatus.processed} / {jobStatus.total}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} className="h-2" />
        <ScrollArea className="h-48 rounded border p-3">
          <div className="space-y-1 font-mono text-xs">
            {jobStatus.logs.map((log, i) => {
              const [type, isbn, source, campos] = log.split("|");
              return (
                <div key={i} className="flex items-center gap-2">
                  <LogIcon type={type} />
                  <span className="text-muted-foreground">{isbn}</span>
                  {source && (
                    <span className="text-foreground">— {source}</span>
                  )}
                  {campos && (
                    <span className="text-muted-foreground">({campos})</span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
