import { useState } from "react";
import { Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCreateGiftCard } from "./hooks";

const PRESET_VALUES = ["20000", "50000", "100000", "150000", "200000"];

export default function CreateGiftCardForm() {
  const [value, setValue] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [expiresMonths, setExpiresMonths] = useState("12");
  const { toast } = useToast();
  const createMutation = useCreateGiftCard();

  const effectiveValue = value === "custom" ? customValue : value;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveValue || Number(effectiveValue) <= 0) {
      toast({ title: "Error", description: "Ingresa un valor válido", variant: "destructive" });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        initial_value: effectiveValue,
        note,
        customer_email: email,
        expires_months: Number(expiresMonths),
      });

      toast({
        title: "Gift Card creada",
        description: `Código: ${result.gift_card.code} — Valor: $${Number(result.gift_card.initial_value).toLocaleString("es-CO")} COP`,
      });

      // Reset form
      setValue("");
      setCustomValue("");
      setNote("");
      setEmail("");
    } catch (err) {
      toast({
        title: "Error al crear",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Crear Gift Card
        </CardTitle>
        <CardDescription>
          Genera una nueva tarjeta de regalo en Shopify
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">Valor (COP)</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger id="value">
                <SelectValue placeholder="Selecciona un valor" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    ${Number(v).toLocaleString("es-CO")} COP
                  </SelectItem>
                ))}
                <SelectItem value="custom">Valor personalizado</SelectItem>
              </SelectContent>
            </Select>
            {value === "custom" && (
              <Input
                type="number"
                placeholder="Ej: 75000"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                min={1}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email del cliente (opcional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="cliente@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si se proporciona, la gift card se asocia al cliente en Shopify
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expiración</Label>
            <Select value={expiresMonths} onValueChange={setExpiresMonths}>
              <SelectTrigger id="expires">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
                <SelectItem value="36">36 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota interna (opcional)</Label>
            <Textarea
              id="note"
              placeholder="Ej: Regalo corporativo para evento..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            type="submit"
            disabled={createMutation.isPending || !effectiveValue}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Gift className="mr-2 h-4 w-4" />
                Crear Gift Card
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
