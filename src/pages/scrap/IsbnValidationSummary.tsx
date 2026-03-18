import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface IsbnValidationSummaryProps {
  validCount: number;
  invalidIsbns: string[];
  isbnColumn: string;
}

export default function IsbnValidationSummary({
  validCount,
  invalidIsbns,
  isbnColumn,
}: IsbnValidationSummaryProps) {
  return (
    <div className="space-y-3">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <strong>{validCount}</strong> ISBNs válidos detectados en columna{" "}
          <Badge variant="secondary">{isbnColumn}</Badge>
        </AlertDescription>
      </Alert>
      {invalidIsbns.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{invalidIsbns.length}</strong> ISBNs inválidos (serán omitidos)
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">
                Ver ISBNs inválidos
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs font-mono">
                {invalidIsbns.map((isbn, i) => (
                  <div key={i}>{isbn}</div>
                ))}
              </div>
            </details>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
