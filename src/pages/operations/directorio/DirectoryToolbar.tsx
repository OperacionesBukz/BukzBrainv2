import { Search, Download, Filter, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { DIRECTORY_STATUSES } from "./types";
import type { DirectoryStatus } from "./types";

interface DirectoryToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: DirectoryStatus | "Todos";
  onFilterStatusChange: (v: DirectoryStatus | "Todos") => void;
  count: number;
  onExport: () => void;
  onImport: () => void;
  isAdmin: boolean;
  entityLabel: string;
}

export default function DirectoryToolbar({
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  count,
  onExport,
  onImport,
  isAdmin,
  entityLabel,
}: DirectoryToolbarProps) {
  const hasActiveFilters = filterStatus !== "Todos";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Buscar ${entityLabel.toLowerCase()}...`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-3" align="start">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Estado
            </label>
            <select
              value={filterStatus}
              onChange={(e) =>
                onFilterStatusChange(
                  e.target.value as DirectoryStatus | "Todos"
                )
              }
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Todos">Todos los estados</option>
              {DIRECTORY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <div className="border-t pt-2 text-right">
              <span
                className="text-xs text-primary hover:underline cursor-pointer"
                onClick={() => onFilterStatusChange("Todos")}
              >
                Limpiar
              </span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {count} registro{count !== 1 ? "s" : ""}
      </span>

      {isAdmin && (
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      )}

      {!isAdmin && (
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      )}
    </div>
  );
}
