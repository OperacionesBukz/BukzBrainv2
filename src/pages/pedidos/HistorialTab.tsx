import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePedidosLog } from "./hooks";

function formatDate(ts: { seconds?: number } | null | undefined): string {
  if (!ts?.seconds) return "\u2014";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialTab() {
  const { logs, loading } = usePedidosLog();
  const { isAdmin } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "pedidos_log", deleteId));
      toast.success("Registro eliminado");
    } catch (e) {
      toast.error("Error al eliminar registro");
      console.error(e);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando historial...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay pedidos registrados aún.
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[500px] border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Mes / Año</TableHead>
            <TableHead>Enviado por</TableHead>
            <TableHead>Fecha</TableHead>
            {isAdmin && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {log.estado === "enviado" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={log.tipo === "sede" ? "default" : "secondary"}>
                  {log.tipo === "sede" ? "Sede" : "Ciudad"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{log.proveedor}</TableCell>
              <TableCell>{log.destino}</TableCell>
              <TableCell>{log.tipoPedido}</TableCell>
              <TableCell>
                {log.mes} {log.anio}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {log.enviadoPorNombre}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDate(log.creadoEn as { seconds?: number } | null)}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(log.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registro</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este registro del historial? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
