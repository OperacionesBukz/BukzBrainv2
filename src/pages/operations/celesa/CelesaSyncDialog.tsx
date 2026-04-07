import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchCelesaSyncOrders,
  getCelesaSyncStatus,
  importCelesaSyncOrders,
  type SyncOrder,
} from "@/pages/celesa/api";

interface CelesaSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "fetching" | "preview" | "importing" | "done" | "error";

export default function CelesaSyncDialog({
  open,
  onOpenChange,
}: CelesaSyncDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("fetching");
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SyncOrder[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importedCount, setImportedCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlight = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStep("fetching");
    setPhase(null);
    setError(null);
    setOrders([]);
    setSelected(new Set());
    setImportedCount(0);
  }, [stopPolling]);

  const pollStatus = useCallback(async () => {
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const s = await getCelesaSyncStatus();
      setPhase(s.phase);

      if (!s.running) {
        stopPolling();
        if (s.error) {
          setError(s.error);
          setStep("error");
        } else if (s.orders) {
          setOrders(s.orders);
          setSelected(new Set(s.orders.map((_, i) => i)));
          setStep(s.orders.length > 0 ? "preview" : "preview");
        }
      }
    } catch (e) {
      stopPolling();
      setError(e instanceof Error ? e.message : "Error de conexión");
      setStep("error");
    } finally {
      pollInFlight.current = false;
    }
  }, [stopPolling]);

  const startFetch = useCallback(async () => {
    reset();
    try {
      const resp = await fetchCelesaSyncOrders();
      if (!resp.success) {
        setError(resp.message);
        setStep("error");
        return;
      }
      // Start polling
      pollRef.current = setInterval(pollStatus, 2000);
      setTimeout(pollStatus, 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error iniciando búsqueda");
      setStep("error");
    }
  }, [reset, pollStatus]);

  // Auto-start fetch when dialog opens
  useEffect(() => {
    if (open) {
      startFetch();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    const toImport = orders.filter((_, i) => selected.has(i));
    if (toImport.length === 0) return;

    setStep("importing");
    try {
      const resp = await importCelesaSyncOrders(toImport, user?.email || "sync-shopify");
      if (resp.success) {
        setImportedCount(resp.imported);
        setStep("done");
        toast.success(`${resp.imported} pedido${resp.imported !== 1 ? "s" : ""} importado${resp.imported !== 1 ? "s" : ""}`);
      } else {
        setError(resp.message);
        setStep("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error importando pedidos");
      setStep("error");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) stopPolling();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sincronizar pedidos desde Shopify</DialogTitle>
          <DialogDescription>
            Busca pedidos con location Dropshipping [España] e importa los nuevos al seguimiento.
          </DialogDescription>
        </DialogHeader>

        {/* FETCHING */}
        {step === "fetching" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {phase || "Buscando pedidos en Shopify..."}
            </p>
            <p className="text-xs text-muted-foreground">
              Filtrando por location Dropshipping [España]
            </p>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-destructive text-center max-w-md">
              {error}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
              <Button onClick={startFetch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === "preview" && (
          <div className="flex flex-col gap-4 min-h-0">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium">No se encontraron pedidos nuevos</p>
                <p className="text-xs text-muted-foreground">
                  Todos los pedidos de Dropshipping [España] ya están en el seguimiento
                </p>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cerrar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{orders.length}</span>{" "}
                    pedido{orders.length !== 1 ? "s" : ""} nuevo{orders.length !== 1 ? "s" : ""} encontrado{orders.length !== 1 ? "s" : ""}
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleToggleAll}>
                    {selected.size === orders.length ? "Deseleccionar todos" : "Seleccionar todos"}
                  </Button>
                </div>

                <div className="overflow-auto border rounded-md max-h-[40vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="w-10 px-3 py-2">
                          <Checkbox
                            checked={selected.size === orders.length}
                            onCheckedChange={handleToggleAll}
                          />
                        </th>
                        <th className="text-left px-3 py-2 font-medium">Pedido</th>
                        <th className="text-left px-3 py-2 font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium">Producto</th>
                        <th className="text-left px-3 py-2 font-medium">ISBN</th>
                        <th className="text-left px-3 py-2 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((order, i) => (
                        <tr
                          key={`${order.numeroPedido}-${order.isbn}-${i}`}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => handleToggle(i)}
                        >
                          <td className="px-3 py-1.5">
                            <Checkbox
                              checked={selected.has(i)}
                              onCheckedChange={() => handleToggle(i)}
                            />
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs">{order.numeroPedido}</td>
                          <td className="px-3 py-1.5">{order.cliente}</td>
                          <td className="px-3 py-1.5">{order.producto}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{order.isbn}</td>
                          <td className="px-3 py-1.5">{order.fechaPedido}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleImport} disabled={selected.size === 0}>
                    Importar {selected.size} pedido{selected.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* IMPORTING */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Importando pedidos...</p>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="rounded-full bg-green-500/10 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-medium">
              {importedCount} pedido{importedCount !== 1 ? "s" : ""} importado{importedCount !== 1 ? "s" : ""}
            </p>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
