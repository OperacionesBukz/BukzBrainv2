import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateGiftCardForm from "./gift-cards/CreateGiftCardForm";
import GiftCardList from "./gift-cards/GiftCardList";

export default function GiftCards() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Gift Cards</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Crea y gestiona tarjetas de regalo de Shopify
        </p>
      </div>

      <Tabs defaultValue="crear">
        <TabsList>
          <TabsTrigger value="crear">Crear Gift Card</TabsTrigger>
          <TabsTrigger value="listado">Listado</TabsTrigger>
        </TabsList>
        <TabsContent value="crear" className="max-w-lg mx-auto">
          <CreateGiftCardForm />
        </TabsContent>
        <TabsContent value="listado">
          <GiftCardList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
