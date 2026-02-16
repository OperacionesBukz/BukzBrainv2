import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, ListChecks, BookOpen, CalendarDays, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchItem {
  title: string;
  path: string;
  category: string;
  icon: typeof LayoutDashboard;
}

const searchItems: SearchItem[] = [
  { title: "Dashboard", path: "/", category: "Módulo", icon: LayoutDashboard },
  { title: "Operaciones", path: "/operations", category: "Módulo", icon: ListChecks },
  { title: "Guías", path: "/instructions", category: "Módulo", icon: BookOpen },
  { title: "Solicitudes", path: "/requests", category: "Módulo", icon: CalendarDays },
  { title: "Gestión de Tareas", path: "/operations", category: "Submódulo", icon: ListChecks },
  { title: "Subtareas y Notas", path: "/operations", category: "Submódulo", icon: ListChecks },
  { title: "Creación de Productos", path: "/instructions/creacion-de-productos", category: "Guía", icon: FileText },
  { title: "Facturación POS", path: "/instructions/facturacion-pos", category: "Guía", icon: FileText },
  { title: "Traslados", path: "/instructions/traslados", category: "Guía", icon: FileText },
  { title: "Ingresos", path: "/instructions/ingresos", category: "Guía", icon: FileText },
  { title: "Permisos y Vacaciones", path: "/instructions/permisos-y-vacaciones", category: "Guía", icon: FileText },
  { title: "Solicitud de Vacaciones", path: "/requests", category: "Submódulo", icon: CalendarDays },
  { title: "Permiso Remunerado", path: "/requests", category: "Submódulo", icon: CalendarDays },
  { title: "Permiso No Remunerado", path: "/requests", category: "Submódulo", icon: CalendarDays },
  { title: "Día de Cumpleaños", path: "/requests", category: "Submódulo", icon: CalendarDays },
];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? searchItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar módulos, guías..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        className="pl-9 h-9 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-fade-in">
          {results.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                navigate(item.path);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-theme"
            >
              <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate">{item.title}</p>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {item.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
