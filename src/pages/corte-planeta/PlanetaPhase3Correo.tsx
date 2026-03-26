import { useState, useCallback, useMemo } from "react";
import { Loader2, Send, Plus, Trash2, Upload, FileSpreadsheet, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_RECIPIENTS, MESES } from "./constants";
import { enviarCorreoPlaneta } from "./api";

interface Props {
  onComplete: () => void;
}

function getDefaultDates(): { inicio: string; fin: string; mesInicio: string; mesFin: string; anio: number } {
  const now = new Date();
  const anio = now.getFullYear();
  const mesActual = now.getMonth();

  const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
  const anioInicio = mesActual === 0 ? anio - 1 : anio;

  return {
    inicio: `25 de ${MESES[mesAnterior].toLowerCase()} de ${anioInicio}`,
    fin: `24 de ${MESES[mesActual].toLowerCase()} de ${anio}`,
    mesInicio: MESES[mesAnterior],
    mesFin: MESES[mesActual],
    anio,
  };
}

export default function PlanetaPhase3Correo({ onComplete }: Props) {
  const defaults = useMemo(() => getDefaultDates(), []);

  const [recipients, setRecipients] = useState<string[]>([...DEFAULT_RECIPIENTS]);
  const [newEmail, setNewEmail] = useState("");
  const [fechaInicio, setFechaInicio] = useState(defaults.inicio);
  const [fechaFin, setFechaFin] = useState(defaults.fin);
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const asunto = useMemo(() => {
    return `Corte ${defaults.mesInicio} a ${defaults.mesFin} - ${defaults.anio} - Grupo Editorial Planeta`;
  }, [defaults]);

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
      await enviarCorreoPlaneta(file, recipients, fechaInicio, fechaFin, asunto);
      toast.success("Correo enviado exitosamente");
      setSent(true);
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error enviando correo";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  }, [file, recipients, fechaInicio, fechaFin, asunto, onComplete]);

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
    <div className="space-y-6">
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
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => document.getElementById("planeta-correo-input")?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
            `}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra el archivo final aquí</p>
            <p className="text-xs text-muted-foreground">o haz clic para seleccionar (.xlsx, .xls)</p>
            <input
              id="planeta-correo-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
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

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fecha-inicio">Fecha inicio del período</Label>
          <Input
            id="fecha-inicio"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fecha-fin">Fecha fin del período</Label>
          <Input
            id="fecha-fin"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label>Asunto</Label>
        <p className="text-sm rounded-lg border bg-muted/50 px-3 py-2">{asunto}</p>
      </div>

      {/* Preview */}
      <div className="space-y-1.5">
        <Label>Vista previa del correo</Label>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3">
          <p>Buenas tardes, espero que se encuentren muy bien.</p>
          <p>Adjunto envío el corte correspondiente al período comprendido entre el {fechaInicio} y el {fechaFin}.</p>
          <p>En el archivo podrán encontrar el detalle de:</p>
          <ul className="list-disc list-inside">
            <li>Títulos vendidos por ciudad</li>
            <li>Cantidades correspondientes</li>
          </ul>
          <p>Quedo atento a cualquier inquietud, comentario o solicitud de información adicional.</p>
          <p>Cordial saludo,</p>
        </div>
      </div>

      {/* Send */}
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
