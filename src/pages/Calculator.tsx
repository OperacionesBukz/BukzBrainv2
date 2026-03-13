import { useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RATE = 8500;

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CalculatorPage() {
  const [euros, setEuros] = useState("");

  const numericValue = parseFloat(euros.replace(",", ".")) || 0;
  const result = numericValue * RATE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calculadora EUR → COP</h1>
        <p className="text-muted-foreground">
          Convierte euros a pesos colombianos (tasa fija: {formatCOP(RATE)} por euro)
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Conversor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="euros">Monto en euros (€)</Label>
            <Input
              id="euros"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={euros}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                  setEuros(val);
                }
              }}
              className="text-lg"
            />
            {numericValue > 0 && (
              <p className="text-sm text-muted-foreground">
                {formatEUR(numericValue)}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">Resultado en pesos colombianos</p>
            <p className="text-3xl font-bold tracking-tight">
              {numericValue > 0 ? formatCOP(result) : "$ 0"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
