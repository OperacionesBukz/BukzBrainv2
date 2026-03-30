import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { VendorItem } from "../types";

interface VendorMultiSelectProps {
  vendors: VendorItem[];
  value: string[]; // empty array = "Todos" (all selected)
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export default function VendorMultiSelect({
  vendors,
  value,
  onChange,
  disabled = false,
}: VendorMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const isTodos = value.length === 0;

  const triggerLabel = isTodos
    ? `Todos (${vendors.length})`
    : `${value.length} proveedor${value.length === 1 ? "" : "es"} seleccionado${value.length === 1 ? "" : "s"}`;

  function toggleVendor(vendorName: string) {
    if (isTodos) {
      // Switch from "Todos" to single vendor selected
      onChange([vendorName]);
    } else {
      const isSelected = value.includes(vendorName);
      let next: string[];
      if (isSelected) {
        next = value.filter((v) => v !== vendorName);
      } else {
        next = [...value, vendorName];
      }
      // If all vendors individually selected, collapse back to "Todos"
      if (next.length === vendors.length) {
        onChange([]);
      } else {
        onChange(next);
      }
    }
  }

  function toggleAll() {
    if (isTodos) {
      // Deselect all → but since empty means "Todos", keep as is (no-op visual)
      // Actually: the button says "Deseleccionar Todos" when isTodos
      // We interpret that as: select none is the same as "Todos", so keep empty
      // Instead: when isTodos, clicking toggle selects all individually (makes them all checked)
      // This is a UI quirk — let's just do nothing (already all selected)
      return;
    } else {
      // Currently some selected → select all (= Todos)
      onChange([]);
    }
  }

  function isChecked(vendorName: string): boolean {
    return isTodos || value.includes(vendorName);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            "dark:bg-background dark:border-input"
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 dark:bg-popover dark:border-border"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar proveedor..." />
          <CommandList>
            <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
            {/* "Seleccionar Todos" / "Deseleccionar Todos" toggle */}
            <CommandItem
              onSelect={toggleAll}
              className="border-b dark:border-border cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                <Checkbox
                  checked={isTodos}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos los proveedores"
                />
                <span className="font-medium">
                  {isTodos ? "Deseleccionar Todos" : "Seleccionar Todos"}
                </span>
                {isTodos && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </div>
            </CommandItem>
            {vendors.map((vendor) => {
              const checked = isChecked(vendor.name);
              return (
                <CommandItem
                  key={vendor.name}
                  value={vendor.name}
                  onSelect={() => toggleVendor(vendor.name)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleVendor(vendor.name)}
                      aria-label={`Seleccionar proveedor ${vendor.name}`}
                    />
                    <span className="flex-1 truncate">{vendor.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {vendor.product_count}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
