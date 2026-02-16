import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock, ChevronRight, BookOpen, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Guide {
  id: string;
  title: string;
  categories: string[];
  description: string;
  readTime: string;
  updatedAt: string;
  slug: string;
}

const guides: Guide[] = [
  {
    id: "g1",
    title: "Creación de Productos",
    categories: ["Operaciones"],
    description: "Guía completa para la creación y gestión de productos en el sistema.",
    readTime: "10 min",
    updatedAt: "2026-02-01",
    slug: "creacion-de-productos",
  },
  {
    id: "g2",
    title: "Facturación POS",
    categories: ["Librerías"],
    description: "Procedimiento de facturación en el punto de venta.",
    readTime: "8 min",
    updatedAt: "2026-02-05",
    slug: "facturacion-pos",
  },
  {
    id: "g3",
    title: "Traslados",
    categories: ["Operaciones", "Librerías"],
    description: "Instrucciones para gestionar traslados entre sucursales y bodegas.",
    readTime: "12 min",
    updatedAt: "2026-01-20",
    slug: "traslados",
  },
  {
    id: "g4",
    title: "Ingresos",
    categories: ["Operaciones", "Librerías"],
    description: "Proceso de registro y gestión de ingresos de mercancía.",
    readTime: "10 min",
    updatedAt: "2026-01-25",
    slug: "ingresos",
  },
  {
    id: "g5",
    title: "Permisos y Vacaciones",
    categories: ["General"],
    description: "Políticas y procedimientos para solicitar permisos y vacaciones.",
    readTime: "5 min",
    updatedAt: "2026-02-10",
    slug: "permisos-y-vacaciones",
  },
  {
    id: "g6",
    title: "Pedidos Cancelados, Devoluciones y Cambios",
    categories: ["Operaciones", "Librerías"],
    description: "Guía para gestionar cancelaciones, devoluciones y cambios en Shopify 2026.",
    readTime: "12 min",
    updatedAt: "2026-02-15",
    slug: "pedidos-cancelados-y-devoluciones",
  },
];

const allCategories = ["All", "Operaciones", "Librerías", "General"];

const Instructions = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");

  const filtered = guides.filter((g) => {
    const matchSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCat === "All" || g.categories.includes(selectedCat);
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Guías</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Base de conocimiento y procedimientos internos
        </p>
      </div>

      {/* Browse section header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Explorar Guías</h3>
          <p className="text-sm text-muted-foreground">
            Documentación interna y tutoriales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar guías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 flex-wrap">
        {allCategories.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCat(c)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-theme",
              selectedCat === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            )}
          >
            {c === "All" ? "Todas" : c}
          </button>
        ))}
      </div>

      {/* Guide cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((guide) => (
          <button
            key={guide.id}
            onClick={() => navigate(`/instructions/${guide.slug}`)}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex gap-1.5 flex-wrap">
              {guide.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
            <h4 className="mt-3 text-base font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-theme">
              {guide.title}
            </h4>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
              {guide.description}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {guide.readTime}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-theme">
                Leer <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mb-3" />
          <p className="text-sm">No se encontraron guías</p>
        </div>
      )}
    </div>
  );
};

export default Instructions;
