import { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ClipboardList,
  User as UserIcon,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  department: string;
  status: "todo" | "in-progress" | "done";
  notes: string;
  subtasks: SubTask[];
  createdBy?: string;
  createdAt?: any;
  order?: number;
}

const departments = ["General", "Finanzas", "Marketing", "TI", "RRHH", "Ventas"];

const Operations = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    const libraryEmails = ["librerias@bukz.co", "museo@bukz.co", "bogota109@bukz.co", "vivaenvigado@bukz.co", "lomas@bukz.co"];
    if (libraryEmails.includes(user?.email || "")) {
      navigate("/dashboard");
      toast.error("No tienes permisos para acceder a este módulo");
    }
  }, [user, navigate]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDept, setNewTaskDept] = useState("General");
  const [filterDept, setFilterDept] = useState("All");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "tasks";

  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          order: data.order ?? data.createdAt?.toMillis?.() ?? Date.now(),
        };
      }) as Task[];

      taskList.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
      setTasks(taskList);
    }, (error) => {
      console.error("Firestore subscription error:", error);
      toast.error("Error al sincronizar tareas: " + error.message);
    });

    return () => unsubscribe();
  }, []);

  const handleTabChange = (value: string) => {
    if (value === "panel") {
      window.open("https://paneloperacionesbukz.streamlit.app/", "_blank");
      return;
    }
    setSearchParams({ tab: value });
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTaskTitle.trim(),
        department: newTaskDept,
        status: "todo",
        notes: "",
        subtasks: [],
        createdBy: user?.email || "Usuario desconocido",
        createdAt: serverTimestamp(),
        order: Date.now(),
      });
      setNewTaskTitle("");
      toast.success("Tarea agregada correctamente");
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Error al agregar tarea: " + error.message);
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
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, updates);
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast.error("Error al actualizar tarea");
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
      toast.success("Tarea eliminada");
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error("Error al eliminar tarea");
    }
  };

  const addSubtask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newSubtask: SubTask = {
      id: `s${Date.now()}`,
      title: "Nueva subtarea",
      completed: false,
    };

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        subtasks: [...task.subtasks, newSubtask],
      });
    } catch (error) {
      console.error("Error adding subtask:", error);
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        subtasks: updatedSubtasks,
      });
    } catch (error) {
      console.error("Error toggling subtask:", error);
    }
  };

  const updateSubtaskTitle = async (taskId: string, subtaskId: string, title: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, title } : s
    );

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        subtasks: updatedSubtasks,
      });
    } catch (error) {
      console.error("Error updating subtask title:", error);
    }
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.filter((s) => s.id !== subtaskId);

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        subtasks: updatedSubtasks,
      });
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast.error("Error al eliminar la subtarea");
    }
  };

  const filtered = useMemo(() => tasks.filter((t) => filterDept === "All" || t.department === filterDept), [tasks, filterDept]);
  const pendingTasks = useMemo(() => filtered.filter((t) => t.status !== "done"), [filtered]);
  const completedTasks = useMemo(() => filtered.filter((t) => t.status === "done"), [filtered]);

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;

      if (!destination) return;

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const sourceListId = source.droppableId;
      const destListId = destination.droppableId;

      const isPendingSource = sourceListId === "pending";
      const isPendingDest = destListId === "pending";

      const sourceList = isPendingSource ? pendingTasks : completedTasks;
      const destList = isPendingDest ? pendingTasks : completedTasks;

      let newOrder = 0;

      const destItems = Array.from(destList);

      let simulatedList = [...destItems];
      if (sourceListId === destListId) {
        const [removed] = simulatedList.splice(source.index, 1);
        simulatedList.splice(destination.index, 0, removed);
      }

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

      try {
        const updates: Partial<Task> = { order: newOrder };

        if (sourceListId !== destListId) {
          updates.status = destListId === "completed" ? "done" : "todo";
        }

        await updateDoc(doc(db, "tasks", draggableId), updates);
      } catch (error) {
        console.error("Error moving task:", error);
        toast.error("Error al mover la tarea");
      }
    },
    [pendingTasks, completedTasks]
  );

  const renderTaskCard = (task: Task, index: number, droppableId: string) => {
    const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;
    const totalSubs = task.subtasks?.length || 0;
    const progress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;
    const isDone = task.status === "done";
    const isExpanded = expandedTasks[task.id];

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "rounded-xl border border-border transition-colors",
              isDone ? "bg-success/10 border-success/30" : "bg-card",
              snapshot.isDragging && "shadow-lg scale-[1.02] ring-2 ring-primary/20 z-50"
            )}
            style={provided.draggableProps.style}
          >
            {/* Task header */}
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() =>
                  updateTask(task.id, {
                    status: isDone ? "todo" : "done",
                  })
                }
                className={cn(
                  "shrink-0 transition-theme",
                  isDone ? "text-success" : "text-muted-foreground hover:text-primary"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleExpand(task.id)}
                  className="text-muted-foreground"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
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
                <div className="flex flex-wrap items-center gap-2 mt-1.5 min-w-0">
                  {totalSubs > 0 && (
                    <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {completedSubs}/{totalSubs}
                      </span>
                    </div>
                  )}
                  {task.createdBy && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border">
                      <UserIcon className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[120px]">{task.createdBy}</span>
                    </div>
                  )}
                  {task.createdAt && (
                    <span className="text-xs text-muted-foreground">
                      {format(task.createdAt, "dd MMM", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                {task.department}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-muted-foreground hover:text-destructive transition-theme"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {/* Subtasks */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Subtareas ({completedSubs}/{totalSubs})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addSubtask(task.id)}
                      className="h-6 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" /> Agregar
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="group/sub flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubtask(task.id, sub.id)}
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <input
                          value={sub.title}
                          onChange={(e) =>
                            updateSubtaskTitle(task.id, sub.id, e.target.value)
                          }
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

                {/* Notes */}
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
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Operaciones</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Gestión operativa y archivos del equipo
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">

        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tareas entre áreas
          </TabsTrigger>
          <TabsTrigger value="panel" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Panel Operaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6 mt-0">
          {/* Add task */}
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Título de nueva tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 w-full"
            />
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={newTaskDept}
                onChange={(e) => setNewTaskDept(e.target.value)}
                className="h-10 flex-1 md:flex-none rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Button onClick={addTask} className="gap-1.5 flex-1 md:flex-none">
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {["All", ...departments].map((d) => (
              <button
                key={d}
                onClick={() => setFilterDept(d)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-theme",
                  filterDept === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                )}
              >
                {d === "All" ? "Todos" : d}
              </button>
            ))}
          </div>

          {/* Two-column layout: Pending | Completed */}
          <DragDropContext onDragEnd={onDragEnd}>
            <div className={cn(
              "grid gap-4 md:gap-6",
              isMobile ? "grid-cols-1" : "lg:grid-cols-2"
            )}>
              {/* Pending column */}
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  Pendientes ({pendingTasks.length})
                </h2>
                <Droppable droppableId="pending">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[100px] rounded-xl border border-dashed border-border p-3"
                    >
                      {pendingTasks.map((task, index) =>
                        renderTaskCard(task, index, "pending")
                      )}
                      {pendingTasks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">No hay tareas pendientes</p>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Completed column */}
              <div>
                <h2 className="text-sm font-medium text-success mb-3">
                  Completadas ({completedTasks.length})
                </h2>
                <Droppable droppableId="completed">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2 min-h-[100px] rounded-xl border border-dashed border-success/30 bg-success/5 p-3"
                    >
                      {completedTasks.map((task, index) =>
                        renderTaskCard(task, index, "completed")
                      )}
                      {completedTasks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">No hay tareas completadas</p>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          </DragDropContext>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default Operations;
