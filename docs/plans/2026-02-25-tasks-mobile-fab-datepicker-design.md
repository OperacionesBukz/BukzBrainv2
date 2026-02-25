# Tasks Mobile: FAB + Bottom Sheet + Calendar Popover

**Date:** 2026-02-25
**Status:** Approved

## Problem

On mobile, the Tasks module exposes too many stacked elements in the create-task area:
title input, priority select, "Agregar" button, "Asignar" button, and two date inputs —
all in a vertical column. The native `<input type="date">` elements are also aesthetically
inconsistent across devices.

## Solution

1. **FAB + Bottom Sheet** — replace the exposed form on mobile with a single floating
   action button that opens a bottom sheet containing the form.
2. **Calendar Popover Date Picker** — replace all `<input type="date">` with a custom
   `DatePickerButton` component backed by the already-installed `react-day-picker`.

---

## Architecture

### 1. FAB Button

- Fixed position: `bottom-20 right-4`, `z-50`
- Visible only on mobile: `md:hidden`
- 56×56px circle, `bg-primary`, icon `Plus`
- Opens the bottom sheet on click

### 2. Bottom Sheet

- `fixed inset-x-0 bottom-0 z-50`
- `rounded-t-2xl`, `max-h-[85vh] overflow-y-auto`
- Drag handle: centered 40×4px rounded bar at top
- Backdrop: `fixed inset-0 bg-black/50 z-40`, click closes sheet
- Animation: CSS `translate-y-full → translate-y-0`, `transition-transform duration-300`
- State: `createSheetOpen: boolean`

**Sheet contents (vertical layout):**
```
[título de la nueva tarea        ]
[Prioridad ▾                    ]
[📅 Fecha inicio                ]
[📅 Fecha límite                ]
[        Agregar Tarea          ]
```

### 3. Desktop Behavior

- Existing inline form remains unchanged
- FAB and bottom sheet are `md:hidden` / not rendered on desktop
- The existing form uses `hidden md:flex` or `hidden md:block`

### 4. Admin "Asignar" Button on Mobile

- Moved to a compact secondary button near the section header
- Remains a separate action independent of the create-task FAB

---

## DatePickerButton Component

**File:** `src/components/ui/date-picker.tsx`

**Props:**
```ts
interface DatePickerButtonProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
}
```

**Visual states:**

- Empty: outline button with calendar icon and placeholder text
- With value: shows formatted date (`dd MMM yyyy`, locale `es`) + `✕` clear button
- Popover: Calendar component with `locale: es`, month navigation

**Integration:**
- Personal task form (bottom sheet + desktop inline)
- Assign task dialog

**Date conversion:** `Date | undefined` ↔ ISO string `YYYY-MM-DD` at the call site in Tasks.tsx.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/date-picker.tsx` | Create new `DatePickerButton` component |
| `src/pages/Tasks.tsx` | Add FAB, bottom sheet, hide inline form on mobile, replace date inputs |

## Files NOT Modified

- Desktop layout of Tasks.tsx (inline form stays intact)
- Any other module or page
- Global styles

---

## State Changes in Tasks.tsx

New state variables:
```ts
const [createSheetOpen, setCreateSheetOpen] = useState(false)
```

Date state type changes (personal task form):
```ts
// Before
const [newStartDate, setNewStartDate] = useState("")
const [newDueDate, setNewDueDate] = useState("")

// After
const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined)
const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined)
```

Conversion at save time:
```ts
startDate: newStartDate ? format(newStartDate, "yyyy-MM-dd") : undefined
```
