import { AlertCircle, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealthCheck } from "./gift-cards/hooks";
import CreateGiftCardForm from "./gift-cards/CreateGiftCardForm";
import GiftCardList from "./gift-cards/GiftCardList";

export default function GiftCards() {
  const health = useHealthCheck();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Gift Cards</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Crea y gestiona tarjetas de regalo de Shopify
        </p>
      </div>

      {health.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : health.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexion</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor de operaciones.
            <Button
              variant="outline"
              size="sm"
              onClick={() => health.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="crear">
          <TabsList>
            <TabsTrigger value="crear">Crear Gift Card</TabsTrigger>
            <TabsTrigger value="listado">Listado</TabsTrigger>
          </TabsList>
          <TabsContent value="crear" className="max-w-lg">
            <CreateGiftCardForm />
          </TabsContent>
          <TabsContent value="listado">
            <GiftCardList />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
