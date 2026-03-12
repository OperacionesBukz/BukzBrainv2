import { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  DragDropContext,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Minus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DatePickerButton } from "@/components/ui/date-picker";

import { Task, SubTask, priorities, priorityColor, adminEmails, assignableUsers } from "./tasks/types";
import TaskCard from "./tasks/TaskCard";
import AssignTaskDialog from "./tasks/AssignTaskDialog";

const Tasks = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Media");
  const [loading, setLoading] = useState(true);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<"create" | "assign">("create");
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [isTaskFormClosing, setIsTaskFormClosing] = useState(false);

  // Personal task creation dates
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

  const closeTaskForm = () => {
    if (!showNewTaskForm || isTaskFormClosing) return;
    setIsTaskFormClosing(true);
    setNewTaskTitle("");
    setNewTaskPriority("Media");
    setNewStartDate(undefined);
    setNewDueDate(undefined);
  };

  // Close new-task form on Escape
  useEffect(() => {
    if (!showNewTaskForm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTaskForm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showNewTaskForm, isTaskFormClosing]);

  // Assign task dialog
  const canAssign = adminEmails.includes(user?.email || "");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignPriority, setAssignPriority] = useState("Media");
  const [assignTo, setAssignTo] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignSubtasks, setAssignSubtasks] = useState<SubTask[]>([]);
  const [assignStartDate, setAssignStartDate] = useState<Date | undefined>(undefined);
  const [assignDueDate, setAssignDueDate] = useState<Date | undefined>(undefined);

  // Fetch private tasks from Firestore (own tasks + tasks assigned to me)
  useEffect(() => {
    if (!user) return;

    // Query 1: tasks created by me
    const qOwn = query(
      collection(db, "user_tasks"),
      where("userId", "==", user.uid)
    );

    // Query 2: tasks assigned to my email
    const qAssigned = query(
      collection(db, "user_tasks"),
      where("assignedTo", "==", user.email)
    );

    const taskMap = new Map<string, Task>();

    const processSnapshot = () => {
      const allTasks = Array.from(taskMap.values());
      allTasks.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
      setTasks(allTasks);
      setLoading(false);
    };

    const unsub1 = onSnapshot(qOwn, (snapshot) => {
      snapshot.docs.forEach(d => {
        taskMap.set(d.id, {
          id: d.id,
          ...d.data(),
          order: d.data().order ?? d.data().createdAt?.toMillis?.() ?? Date.now(),
        } as Task);
      });
      // Remove deleted docs
      const ownIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((_, key) => {
        const task = taskMap.get(key);
        if (task && !task.assignedTo && !ownIds.has(key)) taskMap.delete(key);
      });
      processSnapshot();
    }, (error) => {
      console.error("Error fetching own tasks:", error);
      setLoading(false);
    });

    const unsub2 = onSnapshot(qAssigned, (snapshot) => {
      // First remove old assigned tasks not in this snapshot
      const assignedIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((task, key) => {
        if (task.assignedTo === user.email && !assignedIds.has(key)) taskMap.delete(key);
      });
      snapshot.docs.forEach(d => {
        taskMap.set(d.id, {
          id: d.id,
          ...d.data(),
          order: d.data().order ?? d.data().createdAt?.toMillis?.() ?? Date.now(),
        } as Task);
      });
      processSnapshot();
    }, (error) => {
      console.error("Error fetching assigned tasks:", error);
      setLoading(false);
    });

    return () => { unsub1(); unsub2(); };
  }, [user]);

  const addTask = async (): Promise<boolean> => {
    if (!newTaskTitle.trim() || !user) return false;

    try {
      const newTaskData: Record<string, any> = {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        status: "todo",
        notes: "",
        subtasks: [],
        userId: user.uid,
        createdAt: serverTimestamp(),
        order: Date.now(),
      };
      if (newStartDate) newTaskData.startDate = format(newStartDate, "yyyy-MM-dd");
      if (newDueDate) newTaskData.dueDate = format(newDueDate, "yyyy-MM-dd");

      await addDoc(collection(db, "user_tasks"), newTaskData);
      setNewTaskTitle("");
      setNewTaskPriority("Media");
      setNewStartDate(undefined);
      setNewDueDate(undefined);
      toast.success("Tarea agregada");
      return true;
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Error al guardar la tarea");
      return false;
    }
  };

  const assignTask = async () => {
    if (!assignTitle.trim() || !assignTo || !user) return;

    try {
      const assignData: Record<string, any> = {
        title: assignTitle.trim(),
        priority: assignPriority,
        status: "todo",
        notes: assignNotes.trim(),
        subtasks: assignSubtasks,
        userId: "",
        assignedTo: assignTo,
        assignedBy: user.email || "Desconocido",
        createdAt: serverTimestamp(),
        order: Date.now(),
      };
      if (assignStartDate) assignData.startDate = format(assignStartDate, "yyyy-MM-dd");
      if (assignDueDate) assignData.dueDate = format(assignDueDate, "yyyy-MM-dd");
      await addDoc(collection(db, "user_tasks"), assignData);
      setAssignTitle("");
      setAssignPriority("Media");
      setAssignTo("");
      setAssignNotes("");
      setAssignSubtasks([]);
      setAssignStartDate(undefined);
      setAssignDueDate(undefined);
      setAssignDialogOpen(false);
      toast.success("Tarea asignada correctamente");
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Error al asignar la tarea");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const taskRef = doc(db, "user_tasks", id);
      await updateDoc(taskRef, updates);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Error al actualizar la tarea");
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, "user_tasks", id));
      toast.success("Tarea eliminada");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Error al eliminar la tarea");
    }
  };

  const addSubtask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = [
      ...task.subtasks,
      { id: `ps${Date.now()}`, title: "Nueva subtarea", completed: false },
    ];

    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const updateSubtaskTitle = async (taskId: string, subtaskId: string, title: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, title } : s
    );

    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtasks = task.subtasks.filter((s) => s.id !== subtaskId);

    try {
      await updateTask(taskId, { subtasks: newSubtasks });
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast.error("Error al eliminar la subtarea");
    }
  };

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const sourceListId = source.droppableId;
      const destListId = destination.droppableId;

      const isPendingSource = sourceListId === "pending";
      const isPendingDest = destListId === "pending";

      const sourceList = isPendingSource ? pendingTasks : completedTasks;
      const destList = isPendingDest ? pendingTasks : completedTasks;

      let newOrder = 0;

      if (sourceListId === destListId) {
        const items = Array.from(sourceList);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);

        const prevItem = items[destination.index - 1];
        const nextItem = items[destination.index + 1];

        const prevOrder = prevItem ? (prevItem.order ?? 0) : null;
        const nextOrder = nextItem ? (nextItem.order ?? 0) : null;

        if (prevItem && nextItem) {
          newOrder = ((prevOrder ?? 0) + (nextOrder ?? 0)) / 2;
        } else if (prevItem) {
          newOrder = (prevOrder ?? 0) - 100000;
        } else if (nextItem) {
          newOrder = (nextOrder ?? 0) + 100000;
        } else {
          newOrder = Date.now();
        }
      } else {
        const items = destList;
        if (items.length === 0) {
          newOrder = Date.now();
        } else if (destination.index === 0) {
          newOrder = (items[0].order ?? 0) + 100000;
        } else if (destination.index >= items.length) {
          newOrder = (items[items.length - 1].order ?? 0) - 100000;
        } else {
          const above = items[destination.index - 1];
          const below = items[destination.index];
          newOrder = ((above.order ?? 0) + (below.order ?? 0)) / 2;
        }
      }

      // Optimistic local update
      setTasks((prevTasks) => {
        const taskIndex = prevTasks.findIndex(t => t.id === draggableId);
        if (taskIndex === -1) return prevTasks;

        const updatedTask = {
          ...prevTasks[taskIndex],
          order: newOrder,
          status: (destListId === "completed" ? "done" : "todo") as "todo" | "done"
        };

        const newTasks = [...prevTasks];
        newTasks[taskIndex] = updatedTask;
        newTasks.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

        return newTasks;
      });

      // Persist to Firestore
      try {
        const updates: Partial<Task> = { order: newOrder };
        if (sourceListId !== destListId) {
          updates.status = destListId === "completed" ? "done" : "todo";
        }
        await updateDoc(doc(db, "user_tasks", draggableId), updates);
      } catch (error) {
        console.error("Error moving task:", error);
        toast.error("Error al mover la tarea");
      }
    },
    [pendingTasks, completedTasks]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Tareas</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Tu gestor de tareas personal (Privado)
        </p>
      </div>

      <div className="hidden md:block">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (showNewTaskForm) {
                closeTaskForm();
              } else {
                setShowNewTaskForm(true);
              }
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span className={cn(
              "flex items-center justify-center h-6 w-6 rounded-full border transition-all",
              showNewTaskForm
                ? "border-yellow-400 bg-yellow-400/20 text-black dark:text-yellow-500"
                : "border-yellow-400/60 bg-yellow-400/10 group-hover:bg-yellow-400/20 group-hover:border-yellow-400 text-black dark:text-yellow-500"
            )}>
              {showNewTaskForm ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </span>
            Nueva tarea
          </button>
          {canAssign && (
            <button
              onClick={() => setAssignDialogOpen(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span className="flex items-center justify-center h-6 w-6 rounded-full border border-primary/40 bg-primary/10 group-hover:bg-primary/20 group-hover:border-primary transition-all text-black dark:text-primary">
                <UserPlus className="h-3.5 w-3.5" />
              </span>
              Asignar tarea
            </button>
          )}
        </div>

        {(showNewTaskForm || isTaskFormClosing) && (
          <div
            onAnimationEnd={() => {
              if (isTaskFormClosing) {
                setShowNewTaskForm(false);
                setIsTaskFormClosing(false);
              }
            }}
            className={cn(
              "flex flex-col gap-2 bg-card p-3 rounded-xl border border-primary/20 shadow-sm max-w-lg mt-2 overflow-hidden",
              isTaskFormClosing
                ? "animate-out fade-out slide-out-to-top-2 duration-200 fill-mode-forwards"
                : "animate-in fade-in slide-in-from-top-2 duration-200"
            )}>
            {/* Fila 1: Input título + Select prioridad */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Input
                placeholder="Título de la tarea..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                autoFocus
                className="h-8 text-sm px-3 flex-1 min-w-0"
              />
              <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                <SelectTrigger
                  className={cn(
                    "h-8 w-auto min-w-[88px] text-xs px-2 shrink-0 border-0 focus:ring-1 gap-1",
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
            {/* Fila 2: Fechas + Agregar */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <DatePickerButton
                value={newStartDate}
                onChange={setNewStartDate}
                placeholder="Inicio"
                className="h-7 w-auto max-w-[140px] text-xs"
              />
              <DatePickerButton
                value={newDueDate}
                onChange={setNewDueDate}
                placeholder="Límite"
                className="h-7 w-auto max-w-[140px] text-xs"
              />
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await addTask();
                  if (ok) closeTaskForm();
                }}
                disabled={!newTaskTitle.trim()}
                className="h-7 text-xs px-3 gap-1 shrink-0"
              >
                <Plus className="h-3 w-3" /> Agregar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => setCreateSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Nueva tarea"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile bottom Sheet */}
      <Sheet open={createSheetOpen && isMobile} onOpenChange={(open) => {
        setCreateSheetOpen(open);
        if (!open) setSheetTab("create");
      }}>
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-2xl px-4 pb-8 pt-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left">
              {canAssign ? (
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSheetTab("create")}
                    className={cn(
                      "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                      sheetTab === "create"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    Para mí
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetTab("assign")}
                    className={cn(
                      "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                      sheetTab === "assign"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    Asignar
                  </button>
                </div>
              ) : "Nueva tarea"}
            </SheetTitle>
          </SheetHeader>

          {sheetTab === "create" ? (
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Título de la tarea..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const ok = await addTask();
                    if (ok) setCreateSheetOpen(false);
                  }
                }}
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
                onClick={async () => {
                  const ok = await addTask();
                  if (ok) setCreateSheetOpen(false);
                }}
                disabled={!newTaskTitle.trim()}
                className="w-full gap-1.5"
              >
                <Plus className="h-4 w-4" /> Agregar tarea
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignar a..." />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers
                    .filter(u => u.email !== user?.email)
                    .map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.label}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <Input
                placeholder="Título de la tarea..."
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
              />
              <Select value={assignPriority} onValueChange={setAssignPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePickerButton
                value={assignStartDate}
                onChange={setAssignStartDate}
                placeholder="Fecha inicio"
              />
              <DatePickerButton
                value={assignDueDate}
                onChange={setAssignDueDate}
                placeholder="Fecha límite"
              />
              <Textarea
                placeholder="Notas (opcional)..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                className="min-h-[70px] text-sm resize-none"
              />
              <Button
                onClick={async () => {
                  await assignTask();
                  setCreateSheetOpen(false);
                }}
                disabled={!assignTitle.trim() || !assignTo}
                className="w-full gap-1.5"
              >
                <UserPlus className="h-4 w-4" /> Asignar tarea
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign task dialog */}
      <AssignTaskDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        assignTitle={assignTitle}
        setAssignTitle={setAssignTitle}
        assignPriority={assignPriority}
        setAssignPriority={setAssignPriority}
        assignTo={assignTo}
        setAssignTo={setAssignTo}
        assignNotes={assignNotes}
        setAssignNotes={setAssignNotes}
        assignSubtasks={assignSubtasks}
        setAssignSubtasks={setAssignSubtasks}
        assignStartDate={assignStartDate}
        setAssignStartDate={setAssignStartDate}
        assignDueDate={assignDueDate}
        setAssignDueDate={setAssignDueDate}
        assignTask={assignTask}
        userEmail={user?.email ?? undefined}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={cn(
          "grid gap-4 md:gap-6",
          isMobile ? "grid-cols-1" : "lg:grid-cols-2"
        )}>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Pendientes ({pendingTasks.length})</h2>
            <Droppable droppableId="pending">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[100px] rounded-xl border border-dashed border-border p-3">
                  {loading ? (
                    <p className="text-xs text-muted-foreground text-center py-8 italic">Cargando...</p>
                  ) : (
                    pendingTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        expandedTasks={expandedTasks}
                        toggleExpand={toggleExpand}
                        updateTask={updateTask}
                        deleteTask={deleteTask}
                        addSubtask={addSubtask}
                        toggleSubtask={toggleSubtask}
                        updateSubtaskTitle={updateSubtaskTitle}
                        deleteSubtask={deleteSubtask}
                      />
                    ))
                  )}
                  {!loading && pendingTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No hay tareas pendientes</p>}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
          <div>
            <h2 className="text-sm font-medium text-success mb-3">Completadas ({completedTasks.length})</h2>
            <Droppable droppableId="completed">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 min-h-[100px] rounded-xl border border-dashed border-success/30 bg-success/5 p-3">
                  {loading ? (
                    <p className="text-xs text-muted-foreground text-center py-8 italic">Cargando...</p>
                  ) : (
                    completedTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        expandedTasks={expandedTasks}
                        toggleExpand={toggleExpand}
                        updateTask={updateTask}
                        deleteTask={deleteTask}
                        addSubtask={addSubtask}
                        toggleSubtask={toggleSubtask}
                        updateSubtaskTitle={updateSubtaskTitle}
                        deleteSubtask={deleteSubtask}
                      />
                    ))
                  )}
                  {!loading && completedTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No hay tareas completadas</p>}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default Tasks;
