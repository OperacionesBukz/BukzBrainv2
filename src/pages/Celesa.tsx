import CelesaTab from "./operations/celesa/CelesaTab";

const Celesa = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Celesa</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Seguimiento de pedidos de importación
      </p>
    </div>
    <CelesaTab />
  </div>
);

export default Celesa;
