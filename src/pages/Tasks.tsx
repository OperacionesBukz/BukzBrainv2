import { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  MessageSquare,
  Circle,
  CheckCircle2,
  UserPlus,
  User as UserIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: "todo" | "done";
  notes: string;
  subtasks: SubTask[];
  userId: string;
  createdAt: any;
  order?: number;
  assignedTo?: string;
  assignedBy?: string;
  startDate?: string;
  dueDate?: string;
}

const priorities = ["Baja", "Media", "Alta", "Urgente"];

const adminEmails = ["operaciones@bukz.co", "cedi@bukz.co", "ux@bukz.co"];

const assignableUsers = [
  { email: "operaciones@bukz.co", label: "Operaciones" },
  { email: "cedi@bukz.co", label: "CEDI" },
  { email: "ux@bukz.co", label: "UX" },
];

const priorityColor: Record<string, string> = {
  Baja: "bg-muted text-muted-foreground",
  Media: "bg-info/15 text-info",
  Alta: "bg-warning/15 text-warning",
  Urgente: "bg-destructive/15 text-destructive",
};

const formatDate = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM", { locale: es });

const toDate = (s: string | undefined): Date | undefined =>
  s ? new Date(s + "T00:00:00") : undefined;

const Tasks = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Media");
  const [loading, setLoading] = useState(true);

  // Personal task creation dates
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

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

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

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
      setNewStartDate(undefined);
      setNewDueDate(undefined);
      toast.success("Tarea agregada");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Error al guardar la tarea");
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

  const renderTaskCard = (task: Task, index: number) => {
    const completedSubs = task.subtasks.filter((s) => s.completed).length;
    const totalSubs = task.subtasks.length;
    const progress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;
    const isDone = task.status === "done";
    const isExpanded = expandedTasks[task.id];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = task.dueDate ? (new Date(task.dueDate + "T00:00:00") < today && !isDone) : false;

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "rounded-xl border border-border transition-shadow",
              isDone ? "bg-success/10 border-success/30" : "bg-card",
              snapshot.isDragging && "shadow-lg"
            )}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() =>
                  updateTask(task.id, { status: isDone ? "todo" : "done" })
                }
                className={cn(
                  "shrink-0 transition-theme",
                  isDone ? "text-success" : "text-muted-foreground hover:text-primary"
                )}
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleExpand(task.id)} className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {task.notes && (
                  <MessageSquare className="h-3 w-3 text-foreground fill-yellow-400 animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  value={task.title}
                  onChange={(e) => updateTask(task.id, { title: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={cn(
                    "text-sm font-medium bg-transparent outline-none w-full",
                    isDone ? "text-success line-through" : "text-foreground"
                  )}
                />
                {totalSubs > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {completedSubs}/{totalSubs}
                    </span>
                  </div>
                )}
                {task.assignedBy && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 w-fit">
                    <UserIcon className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[150px]">Asignada por {task.assignedBy.split("@")[0]}</span>
                  </div>
                )}
                {(task.startDate || task.dueDate) && (
                  <div className={cn(
                    "flex items-center gap-1 mt-1 text-xs px-1.5 py-0.5 rounded border w-fit",
                    isOverdue
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : "text-muted-foreground bg-muted/50 border-border"
                  )}>
                    <CalendarIcon className="h-2.5 w-2.5" />
                    <span>
                      {task.startDate && formatDate(task.startDate)}
                      {task.startDate && task.dueDate && " → "}
                      {task.dueDate && formatDate(task.dueDate)}
                    </span>
                  </div>
                )}
              </div>
              <Select
                value={task.priority}
                onValueChange={(newPriority) => updateTask(task.id, { priority: newPriority })}
              >
                <SelectTrigger
                  className={cn(
                    "h-auto w-auto min-w-[80px] px-2 py-0.5 text-xs rounded-full font-medium border-0 gap-1 focus:ring-1",
                    priorityColor[task.priority] || "bg-muted text-muted-foreground"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            priorityColor[p]?.replace(/text-\S+/, '') || "bg-muted"
                          )}
                        />
                        {p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive transition-theme">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Subtareas ({completedSubs}/{totalSubs})</span>
                    <Button variant="ghost" size="sm" onClick={() => addSubtask(task.id)} className="h-6 text-xs gap-1">
                      <Plus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {task.subtasks.map((sub) => (
                      <div key={sub.id} className="group/sub flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubtask(task.id, sub.id)}
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <input
                          value={sub.title}
                          onChange={(e) => updateSubtaskTitle(task.id, sub.id, e.target.value)}
                          className={cn(
                            "flex-1 bg-transparent text-sm text-foreground outline-none",
                            sub.completed && "line-through text-muted-foreground"
                          )}
                        />
                        <button
                          onClick={() => deleteSubtask(task.id, sub.id)}
                          className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" /> Fechas
                  </div>
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
                          isOverdue && "border-destructive/50 bg-destructive/5 text-destructive"
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> Notas
                  </div>
                  <Textarea
                    value={task.notes}
                    onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                    placeholder="Agregar notas..."
                    className="min-h-[60px] text-sm resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Tareas</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Tu gestor de tareas personal (Privado)
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="Nueva tarea..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            className="flex-1 w-full"
          />
          <select
            value={newTaskPriority}
            onChange={(e) => setNewTaskPriority(e.target.value)}
            className="h-10 flex-1 md:flex-none rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Button onClick={addTask} className="gap-1.5 flex-1 md:flex-none">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
          {canAssign && (
            <Button variant="outline" onClick={() => setAssignDialogOpen(true)} className="gap-1.5 flex-1 md:flex-none">
              <UserPlus className="h-4 w-4" /> Asignar
            </Button>
          )}
        </div>
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
      </div>

      {/* Assign task dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar tarea a otro usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario destino</label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers
                    .filter(u => u.email !== user?.email)
                    .map(u => (
                      <SelectItem key={u.email} value={u.email}>{u.label} ({u.email})</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Título de la tarea</label>
              <Input
                placeholder="Título de la tarea..."
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridad</label>
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
            </div>
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
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Notas
              </label>
              <Textarea
                placeholder="Agregar notas a la tarea..."
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Subtareas ({assignSubtasks.length})</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAssignSubtasks([
                      ...assignSubtasks,
                      { id: `st${Date.now()}`, title: "", completed: false }
                    ]);
                  }}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Agregar Subtarea
                </Button>
              </div>
              {assignSubtasks.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {assignSubtasks.map((sub, idx) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <Input
                        placeholder={`Subtarea ${idx + 1}...`}
                        value={sub.title}
                        onChange={(e) => {
                          const updated = [...assignSubtasks];
                          updated[idx].title = e.target.value;
                          setAssignSubtasks(updated);
                        }}
                        className="flex-1 text-sm"
                      />
                      <button
                        onClick={() => {
                          setAssignSubtasks(assignSubtasks.filter((_, i) => i !== idx));
                        }}
                        className="text-muted-foreground hover:text-destructive transition-theme"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={assignTask} disabled={!assignTitle.trim() || !assignTo}>
              <UserPlus className="h-4 w-4 mr-2" /> Asignar Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    pendingTasks.map((task, index) => renderTaskCard(task, index))
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
                    completedTasks.map((task, index) => renderTaskCard(task, index))
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
