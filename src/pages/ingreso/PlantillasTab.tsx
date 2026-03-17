import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadTemplate, downloadBlob } from "./api";

const templates = [
  {
    type: "creacion" as const,
    title: "Plantilla de Creación",
    description: "Plantilla para crear nuevos productos en Shopify.",
    filename: "Creacion_productos.xlsx",
  },
  {
    type: "actualizacion" as const,
    title: "Plantilla de Actualización",
    description: "Plantilla para actualizar productos existentes en Shopify.",
    filename: "Plantilla_Actualizacion_Productos.xlsx",
  },
];

export default function PlantillasTab() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (type: "creacion" | "actualizacion", filename: string) => {
    setLoading(type);
    try {
      const blob = await downloadTemplate(type);
      downloadBlob(blob, filename);
      toast.success("Plantilla descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 pt-4">
      {templates.map((t) => (
        <Card key={t.type}>
          <CardHeader>
            <CardTitle className="text-lg">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleDownload(t.type, t.filename)}
              disabled={loading !== null}
            >
              {loading === t.type ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Descargar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
