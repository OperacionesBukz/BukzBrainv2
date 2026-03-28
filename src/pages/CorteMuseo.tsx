import { useState, useCallback, useMemo } from "react";
import { Loader2, Send, Plus, Trash2, Upload, FileSpreadsheet, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "@/pages/ingreso/types";
import { MESES } from "@/pages/corte-planeta/constants";

const DEFAULT_RECIPIENTS = [
  "jessica.gomez@museodeantioquia.co",
  "candy.montoya@museodeantioquia.co",
];

function getDefaults() {
  const now = new Date();
  const mesActual = now.getMonth();
  const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
  const anio = mesActual === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { mes: MESES[mesAnterior], anio: String(anio) };
}

export default function CorteMuseo() {
  const defaults = useMemo(() => getDefaults(), []);

  const [mes, setMes] = useState(defaults.mes);
  const [anio, setAnio] = useState(defaults.anio);
  const [recipients, setRecipients] = useState<string[]>([...DEFAULT_RECIPIENTS]);
  const [newEmail, setNewEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const asunto = useMemo(
    () => `Reporte de Ventas - BUKZ - ABECEDE - ${mes} ${anio}`,
    [mes, anio],
  );

  const handleAddEmail = useCallback(() => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Ingresa un correo válido");
      return;
    }
    if (recipients.includes(email)) {
      toast.error("Este correo ya está en la lista");
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setNewEmail("");
  }, [newEmail, recipients]);

  const handleRemoveEmail = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((e) => e !== email));
  }, []);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      toast.error("Solo se aceptan archivos .xlsx o .xls");
      return;
    }
    setFile(f);
  }, []);

  const handleSend = useCallback(async () => {
    if (!file) {
      toast.error("Selecciona un archivo para adjuntar");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Agrega al menos un destinatario");
      return;
    }

    setIsSending(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("destinatarios", JSON.stringify(recipients));
      form.append("mes", mes);
      form.append("anio", anio);
      form.append("asunto", asunto);

      const res = await resilientFetch(`${API_BASE}/api/corte-museo/enviar-correo`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Error del servidor (${res.status})`);
      }

      toast.success("Correo enviado exitosamente");
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando correo";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }, [file, recipients, mes, anio, asunto]);

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-lg font-medium">Correo enviado exitosamente</p>
        <p className="text-sm text-muted-foreground">
          Enviado a {recipients.join(", ")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Month & Year selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Mes</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Año</Label>
          <Input
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            placeholder="2026"
          />
        </div>
      </div>

      {/* File upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Archivo adjunto</Label>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-muted-foreground/25 p-4">
            <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => document.getElementById("museo-file-input")?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
            `}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra el archivo aquí</p>
            <p className="text-xs text-muted-foreground">o haz clic para seleccionar (.xlsx, .xls)</p>
            <input
              id="museo-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Destinatarios</Label>
        <div className="space-y-2">
          {recipients.map((email) => (
            <div key={email} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-sm flex-1">{email}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveEmail(email)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
            placeholder="Agregar correo..."
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={handleAddEmail} disabled={!newEmail.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subject (readonly) */}
      <div className="space-y-1.5">
        <Label>Asunto</Label>
        <p className="text-sm rounded-lg border bg-muted/50 px-3 py-2">{asunto}</p>
      </div>

      {/* Body preview */}
      <div className="space-y-1.5">
        <Label>Vista previa del correo</Label>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3">
          <p>Buenas tardes, espero que todo marche excelente</p>
          <p>
            Te envío archivo correspondiente a las ventas de la sede Bukz Museo
            de Antioquia del mes de {mes} de {anio}.
          </p>
          <p>Saludos!</p>
        </div>
      </div>

      {/* Send button */}
      <Button onClick={handleSend} disabled={isSending || !file || recipients.length === 0}>
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Enviar correo
          </>
        )}
      </Button>
    </div>
  );
}
