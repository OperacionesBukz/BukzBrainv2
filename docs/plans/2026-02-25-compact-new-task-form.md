# Compact New-Task Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hacer el formulario expandible "Nueva Tarea" más pequeño y minimalista en desktop, sin tocar mobile.

**Architecture:** Cambios puramente visuales (clases Tailwind) en los bloques `showNewTaskForm` de `Tasks.tsx` y `Operations.tsx`. El formulario pasa de 3-4 filas verticales a 2 filas horizontales compactas. No hay cambios de lógica ni de estado.

**Tech Stack:** React, Tailwind CSS, shadcn/ui (Input, Select, Button), DatePickerButton

---

### Task 1: Compactar formulario en `Tasks.tsx`

**Files:**
- Modify: `src/pages/Tasks.tsx:663-735`

**Contexto del bloque actual (líneas 663–735):**
El bloque `showNewTaskForm` dentro de `<div className="hidden md:block">` tiene:
- Un `<Input>` de título con `className="text-sm"` (hereda h-10 de shadcn)
- Chips de prioridad como `<button>` con `px-3 py-1`
- Dos `<DatePickerButton>` con `h-8 flex-1`
- Botones Cancelar/Agregar con `h-8`
- Contenedor con `p-4 gap-3`

**Step 1: Reemplazar el bloque completo del formulario**

Localizar el bloque que empieza en la línea ~663:
```tsx
<div className="flex flex-col gap-3 bg-card p-4 rounded-xl border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
```
Y reemplazarlo con el siguiente JSX compacto (2 filas):

```tsx
<div className="flex flex-col gap-1.5 bg-card p-2.5 rounded-xl border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
  {/* Fila 1: Input título + Select prioridad */}
  <div className="flex items-center gap-1.5">
    <Input
      placeholder="Título de la tarea..."
      value={newTaskTitle}
      onChange={(e) => setNewTaskTitle(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && addTask()}
      autoFocus
      className="h-7 text-xs px-2 flex-1"
    />
    <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
      <SelectTrigger
        className={cn(
          "h-7 w-auto min-w-[80px] text-xs px-2 shrink-0 border-0 focus:ring-1 gap-1",
          priorityColor[newTaskPriority] || "bg-muted text-muted-foreground"
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {priorities.map((p) => (
          <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  {/* Fila 2: Fechas + acciones */}
  <div className="flex items-center gap-1.5">
    <DatePickerButton
      value={newStartDate}
      onChange={setNewStartDate}
      placeholder="Inicio"
      className="h-6 w-24 text-xs shrink-0"
    />
    <DatePickerButton
      value={newDueDate}
      onChange={setNewDueDate}
      placeholder="Límite"
      className="h-6 w-24 text-xs shrink-0"
    />
    <div className="flex-1" />
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setShowNewTaskForm(false);
        setNewTaskTitle("");
        setNewTaskPriority("Media");
        setNewStartDate(undefined);
        setNewDueDate(undefined);
      }}
      className="h-6 text-xs px-2"
    >
      Cancelar
    </Button>
    <Button
      size="sm"
      onClick={async () => {
        const ok = await addTask();
        if (ok) setShowNewTaskForm(false);
      }}
      disabled={!newTaskTitle.trim()}
      className="h-6 text-xs px-3 gap-1"
    >
      <Plus className="h-3 w-3" /> Agregar
    </Button>
  </div>
</div>
```

**Step 2: Verificar en navegador desktop**

Abrir `npm run dev` y navegar a /tasks. Confirmar que:
- El formulario se ve en 2 filas compactas
- El input es delgado (h-7)
- Las fechas son pequeñas (h-6 ~24px)
- El select de prioridad aparece coloreado según el valor
- Mobile (< md) no muestra este formulario (el FAB sigue igual)

**Step 3: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "feat: compact new-task form on desktop in Tasks"
```

---

### Task 2: Compactar formulario en `Operations.tsx`

**Files:**
- Modify: `src/pages/Operations.tsx:613-676`

**Contexto del bloque actual (líneas ~613–676):**
El bloque `showNewTaskForm` dentro de `TabsContent value="tasks"` tiene:
- Un `<Input>` de título con `className="text-sm"`
- Chips de departamento como `<button>` con `px-3 py-1`
- Dos `<input type="date">` con `h-8 flex-1`
- Botones Cancelar/Agregar con `h-8`
- Contenedor con `p-4 gap-3`

**Step 1: Reemplazar el bloque del formulario**

Localizar el bloque que empieza en línea ~613:
```tsx
<div className="flex flex-col gap-3 bg-card p-4 rounded-xl border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
```

Reemplazarlo con:

```tsx
<div className="flex flex-col gap-1.5 bg-card p-2.5 rounded-xl border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
  {/* Fila 1: Input título + Select departamento */}
  <div className="flex items-center gap-1.5">
    <Input
      placeholder="Título de la tarea..."
      value={newTaskTitle}
      onChange={(e) => setNewTaskTitle(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && addTask()}
      autoFocus
      className="h-7 text-xs px-2 flex-1"
    />
    <select
      value={newTaskDept}
      onChange={(e) => setNewTaskDept(e.target.value)}
      className="h-7 rounded-md border border-border bg-secondary px-2 text-xs text-muted-foreground shrink-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
    >
      {departments.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  </div>
  {/* Fila 2: Fechas + acciones */}
  <div className="flex items-center gap-1.5">
    <input
      type="date"
      value={newStartDate}
      onChange={(e) => setNewStartDate(e.target.value)}
      className="h-6 w-24 rounded-md border border-border bg-background px-2 text-xs text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-ring"
    />
    <input
      type="date"
      value={newDueDate}
      onChange={(e) => setNewDueDate(e.target.value)}
      className="h-6 w-24 rounded-md border border-border bg-background px-2 text-xs text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-ring"
    />
    <div className="flex-1" />
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setShowNewTaskForm(false);
        setNewTaskTitle("");
        setNewStartDate("");
        setNewDueDate("");
      }}
      className="h-6 text-xs px-2"
    >
      Cancelar
    </Button>
    <Button size="sm" onClick={addTask} className="h-6 text-xs px-3 gap-1">
      <Plus className="h-3 w-3" /> Agregar
    </Button>
  </div>
</div>
```

**Step 2: Verificar en navegador desktop**

Navegar a /operations → tab "Tareas entre áreas". Confirmar que:
- El formulario se ve en 2 filas compactas
- El input del título es delgado
- Los campos de fecha son pequeños
- Mobile no se ve afectado

**Step 3: Commit**

```bash
git add src/pages/Operations.tsx
git commit -m "feat: compact new-task form on desktop in Operations"
```

---

### Task 3: Deploy

**Step 1: Build y deploy a gh-pages**

```bash
npm run deploy
```

Expected: `Published`
