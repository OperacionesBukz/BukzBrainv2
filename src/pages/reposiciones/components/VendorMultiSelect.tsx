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
  value: string[];
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

  const allNames = vendors.map((v) => v.name);
  const isAllSelected = value.length === vendors.length && vendors.length > 0;
  const isNoneSelected = value.length === 0;

  const triggerLabel = isNoneSelected
    ? "Seleccionar proveedores..."
    : isAllSelected
      ? `Todos (${vendors.length})`
      : `${value.length} proveedor${value.length === 1 ? "" : "es"}`;

  function toggleVendor(vendorName: string) {
    const isSelected = value.includes(vendorName);
    if (isSelected) {
      onChange(value.filter((v) => v !== vendorName));
    } else {
      onChange([...value, vendorName]);
    }
  }

  function toggleAll() {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(allNames);
    }
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
            <CommandItem
              onSelect={toggleAll}
              className="border-b dark:border-border cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900 dark:data-[selected=true]:bg-blue-950/40 dark:data-[selected=true]:text-blue-100"
            >
              <div className="flex items-center gap-2 w-full">
                <Checkbox
                  checked={isAllSelected}
                  aria-label="Seleccionar todos los proveedores"
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <span className="font-medium">
                  {isAllSelected ? "Deseleccionar Todos" : "Seleccionar Todos"}
                </span>
                {isAllSelected && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </div>
            </CommandItem>
            {vendors.map((vendor) => {
              const checked = value.includes(vendor.name);
              return (
                <CommandItem
                  key={vendor.name}
                  value={vendor.name}
                  onSelect={() => toggleVendor(vendor.name)}
                  className="cursor-pointer data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900 dark:data-[selected=true]:bg-blue-950/40 dark:data-[selected=true]:text-blue-100"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Checkbox
                      checked={checked}
                      aria-label={`Seleccionar proveedor ${vendor.name}`}
                      tabIndex={-1}
                      className="pointer-events-none"
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
