import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useApplyInlineUpdate } from "./hooks";
import type { UpdateApplyResult } from "./types";

type ChangesMap = Record<string, Record<string, string>>;

export interface UseInlineEditingOptions {
  onApplied?: (results: UpdateApplyResult[]) => void;
}

export function useInlineEditing(opts?: UseInlineEditingOptions) {
  const [changes, setChanges] = useState<ChangesMap>({});
  const [rowResults, setRowResults] = useState<Record<string, UpdateApplyResult>>({});
  const applyMutation = useApplyInlineUpdate();

  const totalChanges = Object.values(changes).reduce(
    (sum, c) => sum + Object.keys(c).length,
    0,
  );

  const updateField = useCallback(
    (key: string, field: string, newValue: string, originalValue: string) => {
      setChanges((prev) => {
        const copy = { ...prev };
        const row = { ...(copy[key] || {}) };

        if (newValue === originalValue) {
          delete row[field];
        } else {
          row[field] = newValue;
        }

        if (Object.keys(row).length === 0) {
          delete copy[key];
        } else {
          copy[key] = row;
        }
        return copy;
      });
      setRowResults((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    },
    [],
  );

  const handleApply = useCallback(async () => {
    const items = Object.entries(changes).map(([sku, fieldChanges]) => ({
      sku,
      changes: fieldChanges,
    }));

    try {
      const response = await applyMutation.mutateAsync(items);
      const resultMap: Record<string, UpdateApplyResult> = {};
      for (const r of response.results) {
        resultMap[r.sku] = r;
      }
      setRowResults(resultMap);

      setChanges((prev) => {
        const copy = { ...prev };
        for (const r of response.results) {
          if (r.success) delete copy[r.sku];
        }
        return copy;
      });

      if (response.updated > 0) {
        toast.success(`${response.updated} producto(s) actualizado(s) en Shopify`);
      }
      if (response.failed > 0) {
        toast.error(`${response.failed} producto(s) fallaron al actualizar`);
      }

      opts?.onApplied?.(response.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  }, [changes, applyMutation, opts]);

  const handleDiscard = useCallback(() => {
    setChanges({});
    setRowResults({});
  }, []);

  const reset = useCallback(() => {
    setChanges({});
    setRowResults({});
  }, []);

  const getDisplayValue = useCallback(
    (key: string, field: string, originalValue: string): string => {
      return changes[key]?.[field] ?? originalValue;
    },
    [changes],
  );

  const isFieldModified = useCallback(
    (key: string, field: string): boolean => {
      return !!changes[key]?.[field];
    },
    [changes],
  );

  return {
    changes,
    rowResults,
    totalChanges,
    isPending: applyMutation.isPending,
    updateField,
    handleApply,
    handleDiscard,
    reset,
    getDisplayValue,
    isFieldModified,
  };
}
