# Diseño: Formulario "Nueva Tarea" compacto (desktop)

**Fecha:** 2026-02-25
**Alcance:** Solo desktop (`hidden md:block`) en `Tasks.tsx` y `Operations.tsx`
**Mobile:** Sin cambios — usa FAB + bottom sheet, que permanece intacto.

## Problema

El formulario expandible de "Nueva Tarea" ocupa demasiado espacio vertical (~120px). El input de título es demasiado grande (h-10) y los campos de fecha son anchos y largos, resultando en una UI poco estética.

## Solución aprobada — Opción B: Fila doble compacta

El formulario se reorganiza en **2 filas** dentro del mismo contenedor:

```
┌─────────────────────────────────────────────────────┐
│ [ Título de la tarea...                    ] [Dept▾] │
│ [📅 Inicio] [📅 Límite]  · Baja · Media · Alta ·    [Cancelar] [+] │
└─────────────────────────────────────────────────────┘
```

## Cambios de estilo

| Elemento | Antes | Después |
|---|---|---|
| Input título | `h-10 text-sm` | `h-7 text-xs px-2` |
| Select dpto/prioridad | segunda fila, ancho | inline derecha del input, `h-7 text-xs` |
| Campos de fecha | `h-8 flex-1` con label texto | `h-6 text-xs w-28` con solo ícono |
| Chips prioridad/dept | `px-3 py-1 text-xs` | `px-2 py-0.5 text-xs` |
| Botones | `h-8 text-xs` | `h-6 text-xs` |
| Padding contenedor | `p-4` | `p-2.5` |
| Altura total aprox. | ~120px | ~56px |

## Archivos afectados

- `src/pages/Tasks.tsx` — bloque `showNewTaskForm` dentro de `hidden md:block`
- `src/pages/Operations.tsx` — bloque `showNewTaskForm` dentro de `TabsContent value="tasks"`
