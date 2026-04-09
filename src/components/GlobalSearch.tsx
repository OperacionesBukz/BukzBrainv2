import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Package,
  ListChecks,
  ContactRound,
  RotateCcw,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useGlobalSearch,
  recordSelection,
  getRecents,
  getFrequent,
  type SearchResult,
} from "@/hooks/use-global-search";

const TYPE_ICONS: Record<SearchResult["type"], typeof Search> = {
  page: LayoutDashboard,
  product: Package,
  task: ListChecks,
  directory: ContactRound,
  devolucion: RotateCcw,
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  page: "Navegación",
  product: "Productos",
  task: "Tareas",
  directory: "Directorio",
  devolucion: "Devoluciones",
};

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-200/40 dark:bg-yellow-500/20 text-foreground rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}

function SearchResultItem({
  item,
  query,
  onSelect,
}: {
  item: SearchResult;
  query: string;
  onSelect: (item: SearchResult) => void;
}) {
  const Icon = TYPE_ICONS[item.type] || Search;
  return (
    <CommandItem
      value={`${item.type}-${item.id}-${item.title}`}
      onSelect={() => onSelect(item)}
      className="flex items-center gap-3 px-3 py-2.5"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{highlightMatch(item.title, query)}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {highlightMatch(item.subtitle, query)}
          </p>
        )}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border shrink-0">
        {TYPE_LABELS[item.type]}
      </span>
    </CommandItem>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-3 py-2 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="flex-1 space-y-1">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    searchQuery,
    setSearchQuery,
    filteredResults,
    productResults,
    loadingProducts,
    hasResults,
  } = useGlobalSearch();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      recordSelection(item);
      navigate(item.path);
      setOpen(false);
      setSearchQuery("");
    },
    [navigate, setSearchQuery]
  );

  const recents = useMemo(() => (open ? getRecents() : []), [open]);
  const frequent = useMemo(() => (open ? getFrequent() : []), [open]);
  const showIdle = !searchQuery.trim();

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-9 w-full justify-start gap-2 text-sm text-muted-foreground sm:w-64"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline-flex">Buscar...</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      {/* Command palette — Dialog+Command manual en vez de CommandDialog
         porque necesitamos shouldFilter={false} para filtrado custom */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg">
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput
              placeholder="Buscar páginas, productos, tareas, directorio..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {showIdle ? (
                <>
                  {recents.length > 0 && (
                    <CommandGroup heading="Recientes">
                      {recents.slice(0, 5).map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          query=""
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}
                  {frequent.length > 0 && (
                    <>
                      {recents.length > 0 && <CommandSeparator />}
                      <CommandGroup heading="Más buscados">
                        {frequent.map((item) => (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            query=""
                            onSelect={handleSelect}
                          />
                        ))}
                      </CommandGroup>
                    </>
                  )}
                  {recents.length === 0 && frequent.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Escribe para buscar en todo BukzBrain
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!hasResults && !loadingProducts && (
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                  )}

                  {filteredResults.pages.length > 0 && (
                    <CommandGroup heading="Navegación">
                      {filteredResults.pages.map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          query={searchQuery}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}

                  {(productResults.length > 0 || loadingProducts) && (
                    <CommandGroup heading="Productos">
                      {loadingProducts ? (
                        <LoadingSkeleton />
                      ) : (
                        productResults.map((item) => (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            query={searchQuery}
                            onSelect={handleSelect}
                          />
                        ))
                      )}
                    </CommandGroup>
                  )}

                  {filteredResults.tasks.length > 0 && (
                    <CommandGroup heading="Tareas">
                      {filteredResults.tasks.map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          query={searchQuery}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}

                  {filteredResults.directory.length > 0 && (
                    <CommandGroup heading="Directorio">
                      {filteredResults.directory.map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          query={searchQuery}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}

                  {filteredResults.devoluciones.length > 0 && (
                    <CommandGroup heading="Devoluciones">
                      {filteredResults.devoluciones.map((item) => (
                        <SearchResultItem
                          key={item.id}
                          item={item}
                          query={searchQuery}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
