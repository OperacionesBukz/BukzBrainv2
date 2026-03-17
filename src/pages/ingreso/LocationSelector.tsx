import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { MAIN_WAREHOUSES, type LocationItem } from "./types";

interface LocationSelectorProps {
  locations: LocationItem[];
  selected: string[];
  onChange: (names: string[]) => void;
}

export default function LocationSelector({
  locations,
  selected,
  onChange,
}: LocationSelectorProps) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  const mainSet = new Set<string>(MAIN_WAREHOUSES);
  const mainLocations = locations.filter((l) => mainSet.has(l.name));
  const otherLocations = locations.filter((l) => !mainSet.has(l.name));

  const filteredOther = filter
    ? otherLocations.filter((l) =>
        l.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : otherLocations;

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name],
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-3">Bodegas principales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mainLocations.map((loc) => (
            <Label
              key={loc.name}
              className="flex items-center gap-2 font-normal cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(loc.name)}
                onCheckedChange={() => toggle(loc.name)}
              />
              {loc.name}
            </Label>
          ))}
        </div>
      </div>

      {otherLocations.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-0">
              <ChevronsUpDown className="h-4 w-4" />
              Otras bodegas ({otherLocations.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <Input
              placeholder="Filtrar bodegas..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {filteredOther.map((loc) => (
                <Label
                  key={loc.name}
                  className="flex items-center gap-2 font-normal cursor-pointer"
                >
                  <Checkbox
                    checked={selected.includes(loc.name)}
                    onCheckedChange={() => toggle(loc.name)}
                  />
                  {loc.name}
                </Label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
