# Tasks Mobile: FAB + Bottom Sheet + Calendar Popover — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** On mobile, replace the exposed create-task form with a FAB + bottom Sheet; replace all native date inputs with a Calendar Popover component.

**Architecture:** Create a reusable `DatePickerButton` component (Popover + Calendar, already installed). In `Tasks.tsx`, add a FAB button (mobile-only) that opens a `Sheet side="bottom"` with the create form. Hide the existing inline form on mobile. Replace all `<input type="date">` everywhere with `DatePickerButton`.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui (`Sheet`, `Popover`, `Calendar`), date-fns, lucide-react. No new dependencies needed.

---

### Task 1: Create `DatePickerButton` component

**Files:**
- Create: `src/components/ui/date-picker.tsx`

**Step 1: Create the file with this exact code**

```tsx
import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerButtonProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerButton({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
}: DatePickerButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {value ? format(value, "dd MMM yyyy", { locale: es }) : placeholder}
          </span>
          {value && (
            <span
              role="button"
              aria-label="Limpiar fecha"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
                setOpen(false);
              }}
              className="ml-1 rounded-sm opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Verify the file exists**

Run: `ls src/components/ui/date-picker.tsx`
Expected: file listed

**Step 3: Commit**

```bash
git add src/components/ui/date-picker.tsx
git commit -m "feat: add DatePickerButton component with Calendar popover"
```

---

### Task 2: Update state types and `addTask()` for date pickers

**Files:**
- Modify: `src/pages/Tasks.tsx:106-107` and `src/pages/Tasks.tsx:187-213`

**Context:** Lines 106-107 currently declare:
```ts
const [newStartDate, setNewStartDate] = useState("");
const [newDueDate, setNewDueDate] = useState("");
```
And `addTask()` at line 201 uses: `if (newStartDate) newTaskData.startDate = newStartDate;`

**Step 1: Change state declarations (lines 106-107)**

Replace:
```ts
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
```
With:
```ts
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
```

**Step 2: Update `addTask()` date handling (lines 201-202 and 206-207)**

Replace:
```ts
      if (newStartDate) newTaskData.startDate = newStartDate;
      if (newDueDate) newTaskData.dueDate = newDueDate;
```
With:
```ts
      if (newStartDate) newTaskData.startDate = format(newStartDate, "yyyy-MM-dd");
      if (newDueDate) newTaskData.dueDate = format(newDueDate, "yyyy-MM-dd");
```

Replace reset lines (lines 206-207) — currently `setNewStartDate(""); setNewDueDate("");`:
```ts
      setNewStartDate(undefined);
      setNewDueDate(undefined);
```

**Step 3: Build check — no TypeScript errors**

Run: `npx vite build 2>&1 | tail -20`
Expected: builds successfully or only existing warnings

---

### Task 3: Replace inline form date inputs with DatePickerButton

**Files:**
- Modify: `src/pages/Tasks.tsx:650-671`

**Context:** Lines 650-671 currently show two stacked `<input type="date">` rows with Calendar icon + label.

**Step 1: Add import for `DatePickerButton` at top of Tasks.tsx**

After the existing imports (around line 40), add:
```ts
import { DatePickerButton } from "@/components/ui/date-picker";
```

**Step 2: Replace the entire date row block (lines 650-671)**

Replace:
```tsx
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <label className="text-xs text-muted-foreground whitespace-nowrap">Inicio</label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="h-9 flex-1 rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <label className="text-xs text-muted-foreground whitespace-nowrap">Límite</label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-9 flex-1 rounded-md border border-border bg-card px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
```
With:
```tsx
        <div className="flex flex-col md:flex-row gap-2">
          <DatePickerButton
            value={newStartDate}
            onChange={setNewStartDate}
            placeholder="Fecha inicio"
            className="flex-1"
          />
          <DatePickerButton
            value={newDueDate}
            onChange={setNewDueDate}
            placeholder="Fecha límite"
            className="flex-1"
          />
        </div>
```

**Step 3: Build check**

Run: `npx vite build 2>&1 | tail -20`
Expected: no new errors

**Step 4: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "feat: replace inline form date inputs with DatePickerButton"
```

---

### Task 4: Replace date inputs in Assign Dialog

**Files:**
- Modify: `src/pages/Tasks.tsx:117-118`, `src/pages/Tasks.tsx:231-232`, `src/pages/Tasks.tsx:238-240`, `src/pages/Tasks.tsx:718-741`

**Step 1: Change assign date state declarations (lines 117-118)**

Replace:
```ts
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
```
With:
```ts
  const [assignStartDate, setAssignStartDate] = useState<Date | undefined>(undefined);
  const [assignDueDate, setAssignDueDate] = useState<Date | undefined>(undefined);
```

**Step 2: Update `assignTask()` date handling (lines 231-232)**

Replace:
```ts
      if (assignStartDate) assignData.startDate = assignStartDate;
      if (assignDueDate) assignData.dueDate = assignDueDate;
```
With:
```ts
      if (assignStartDate) assignData.startDate = format(assignStartDate, "yyyy-MM-dd");
      if (assignDueDate) assignData.dueDate = format(assignDueDate, "yyyy-MM-dd");
```

**Step 3: Update reset lines in `assignTask()` (lines 238-240)**

Replace:
```ts
      setAssignStartDate("");
      setAssignDueDate("");
```
With:
```ts
      setAssignStartDate(undefined);
      setAssignDueDate(undefined);
```

**Step 4: Replace date inputs in dialog (lines 718-741)**

Replace:
```tsx
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Fecha inicio
                </label>
                <input
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Fecha límite
                </label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
```
With:
```tsx
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> Fecha inicio
                </label>
                <DatePickerButton
                  value={assignStartDate}
                  onChange={setAssignStartDate}
                  placeholder="Inicio"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> Fecha límite
                </label>
                <DatePickerButton
                  value={assignDueDate}
                  onChange={setAssignDueDate}
                  placeholder="Límite"
                />
              </div>
            </div>
```

**Note:** The `Calendar` import from lucide-react is already used elsewhere in the file (task card). Add `CalendarIcon` as alias to distinguish from the UI Calendar component. Update the lucide import at the top:

Replace:
```ts
  Calendar,
```
With:
```ts
  Calendar as CalendarIcon,
```

And update all other usages of `Calendar` icon in the file to `CalendarIcon`:
- Line 452 (task card): `<Calendar className="h-2.5 w-2.5" />` → `<CalendarIcon className="h-2.5 w-2.5" />`
- Line 567: `<Calendar className="h-3 w-3" />` → `<CalendarIcon className="h-3 w-3" />`

**Step 5: Build check**

Run: `npx vite build 2>&1 | tail -20`
Expected: no errors

**Step 6: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "feat: replace assign dialog date inputs with DatePickerButton"
```

---

### Task 5: Replace date inputs in task card expanded view

**Files:**
- Modify: `src/pages/Tasks.tsx:569-593`

**Context:** Inside `renderTaskCard`, the expanded section has two `<input type="date">` that read from `task.startDate` (string) and call `updateTask`. Need to convert string ↔ Date at the call site.

**Helper function** (add inside `renderTaskCard` before the return, after line 421):
```ts
    const toDate = (s: string | undefined): Date | undefined =>
      s ? new Date(s + "T00:00:00") : undefined;
```

**Step 1: Replace the date inputs block (lines 569-593)**

Replace:
```tsx
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap w-10">Inicio</label>
                      <input
                        type="date"
                        value={task.startDate || ""}
                        onChange={(e) => updateTask(task.id, { startDate: e.target.value || undefined })}
                        className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className={cn("text-xs whitespace-nowrap w-10", isOverdue ? "text-destructive" : "text-muted-foreground")}>Límite</label>
                      <input
                        type="date"
                        value={task.dueDate || ""}
                        onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
                        className={cn(
                          "h-8 flex-1 rounded-md border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring",
                          isOverdue
                            ? "border-destructive/50 bg-destructive/5 text-destructive"
                            : "border-border bg-background text-foreground"
                        )}
                      />
                    </div>
                  </div>
```
With:
```tsx
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap w-10 shrink-0">Inicio</label>
                      <DatePickerButton
                        value={toDate(task.startDate)}
                        onChange={(d) => updateTask(task.id, { startDate: d ? format(d, "yyyy-MM-dd") : undefined })}
                        placeholder="Sin fecha"
                        className="h-8 flex-1 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className={cn("text-xs whitespace-nowrap w-10 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>Límite</label>
                      <DatePickerButton
                        value={toDate(task.dueDate)}
                        onChange={(d) => updateTask(task.id, { dueDate: d ? format(d, "yyyy-MM-dd") : undefined })}
                        placeholder="Sin fecha"
                        className={cn(
                          "h-8 flex-1 text-xs",
                          isOverdue && "border-destructive/50 text-destructive"
                        )}
                      />
                    </div>
                  </div>
```

**Step 2: Build check**

Run: `npx vite build 2>&1 | tail -20`
Expected: no errors

**Step 3: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "feat: replace task card date inputs with DatePickerButton"
```

---

### Task 6: Add FAB + bottom Sheet for mobile

**Files:**
- Modify: `src/pages/Tasks.tsx`

**Step 1: Add `createSheetOpen` state (after line 103)**

After:
```ts
  const [loading, setLoading] = useState(true);
```
Add:
```ts
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
```

**Step 2: Add Sheet imports**

In the existing Dialog import block (lines 26-32), add Sheet imports:
```ts
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
```

**Step 3: Wrap existing inline form to hide on mobile**

The existing create form `<div className="flex flex-col gap-2">` starts at line 623. Wrap it:

Replace:
```tsx
      <div className="flex flex-col gap-2">
        <div className="flex flex-col md:flex-row gap-2">
```
With:
```tsx
      <div className="hidden md:flex flex-col gap-2">
        <div className="flex flex-col md:flex-row gap-2">
```

**Step 4: Add FAB button and bottom Sheet after the existing form block**

After the closing `</div>` of the create form (line 672) and before `{/* Assign task dialog */}` (line 674), insert:

```tsx
      {/* Mobile FAB */}
      <button
        onClick={() => setCreateSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Nueva tarea"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile bottom Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-2xl px-4 pb-8 pt-4"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">Nueva tarea</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Título de la tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="w-full"
              autoFocus
            />
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <DatePickerButton
              value={newStartDate}
              onChange={setNewStartDate}
              placeholder="Fecha inicio"
            />
            <DatePickerButton
              value={newDueDate}
              onChange={setNewDueDate}
              placeholder="Fecha límite"
            />
            <Button
              onClick={() => {
                addTask();
                setCreateSheetOpen(false);
              }}
              disabled={!newTaskTitle.trim()}
              className="w-full gap-1.5"
            >
              <Plus className="h-4 w-4" /> Agregar tarea
            </Button>
          </div>
        </SheetContent>
      </Sheet>
```

**Step 5: Build check**

Run: `npx vite build 2>&1 | tail -20`
Expected: builds successfully

**Step 6: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "feat: add mobile FAB and bottom sheet for task creation"
```

---

### Task 7: Deploy to gh-pages

**Step 1: Deploy**

Run: `npm run deploy`
Expected: "Published"

**Step 2: Verify**

Open the app on a mobile device or browser devtools mobile view:
- [ ] The inline create form is hidden on mobile
- [ ] The FAB button appears fixed at bottom-right
- [ ] Tapping FAB opens a bottom sheet with the form
- [ ] DatePickerButton opens a calendar popover
- [ ] Selecting a date shows the formatted date on the button
- [ ] The X button clears the date
- [ ] Adding a task from the sheet works and closes the sheet
- [ ] On desktop (md+), the inline form is still visible with DatePickerButton fields
- [ ] Assign dialog date pickers show Calendar popover
- [ ] Task card expanded date pickers work inline
