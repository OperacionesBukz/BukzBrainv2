import { useState } from "react";
import {
  Loader2,
  Search,
  Ban,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useSearchGiftCards, useDisableGiftCard } from "./hooks";
import type { GiftCard } from "./types";

export default function GiftCardList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const { toast } = useToast();
  const disableMutation = useDisableGiftCard();

  const { data, isLoading, isError, error } = useSearchGiftCards({
    query: activeQuery,
    limit: 50,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchQuery);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado", description: code });
  };

  const handleDisable = async (card: GiftCard) => {
    try {
      await disableMutation.mutateAsync(card.id);
      toast({ title: "Gift Card desactivada", description: `Código: ${card.code}` });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo desactivar",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatMoney = (amount: string) => {
    return `$${Number(amount).toLocaleString("es-CO")}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gift Cards existentes</CardTitle>
        <CardDescription>
          Busca y gestiona las tarjetas de regalo de la tienda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder='Buscar (ej: "enabled:true", email, código...)'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-destructive">
            {error instanceof Error ? error.message : "Error cargando gift cards"}
          </div>
        ) : !data?.gift_cards.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron gift cards
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Valor inicial</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.gift_cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-sm font-mono">
                          {card.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyCode(card.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(card.initial_value)}
                    </TableCell>
                    <TableCell>
                      {formatMoney(card.balance)}
                      <span className="text-xs text-muted-foreground ml-1">
                        {card.currency}
                      </span>
                    </TableCell>
                    <TableCell>
                      {card.enabled ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactiva
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {card.customer_email ? (
                        <div>
                          <div className="text-sm">{card.customer_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {card.customer_email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(card.expires_on)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(card.created_at)}
                    </TableCell>
                    <TableCell>
                      {card.enabled && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Desactivar Gift Card
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Vas a desactivar la gift card{" "}
                                <strong>{card.code}</strong> con balance de{" "}
                                <strong>
                                  {formatMoney(card.balance)} {card.currency}
                                </strong>
                                . Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisable(card)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Desactivar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-xs text-muted-foreground text-right">
            {data.total} resultado{data.total !== 1 ? "s" : ""}
            {data.has_next && " (hay más resultados)"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
