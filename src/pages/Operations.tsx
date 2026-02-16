import { useState, useCallback, useEffect } from "react";
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
  FileText,
  ClipboardList,
  User as UserIcon
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
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
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
}

const departments = ["General", "Finanzas", "Marketing", "TI", "RRHH", "Ventas"];

const Operations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.email === "librerias@bukz.co") {
      navigate("/");
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
          // Handle null timestamp from serverTimestamp() before it syncs
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      }) as Task[];
      setTasks(taskList);
    }, (error) => {
      console.error("Firestore subscription error:", error);
      toast.error("Error al sincronizar tareas: " + error.message);
    });

    return () => unsubscribe();
  }, []);

  const handleTabChange = (value: string) => {
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

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;

      const sourceList = source.droppableId;
      const destList = destination.droppableId;

      if (sourceList !== destList) {
        try {
          await updateDoc(doc(db, "tasks", draggableId), {
            status: destList === "completed" ? "done" : "todo",
          });
        } catch (error) {
          console.error("Error moving task:", error);
        }
      }
    },
    []
  );

  const matchesFilter = (t: Task) => filterDept === "All" || t.department === filterDept;

  const filtered = tasks.filter(matchesFilter);
  const pendingTasks = filtered.filter((t) => t.status !== "done");
  const completedTasks = filtered.filter((t) => t.status === "done");

  const renderTaskCard = (task: Task, index: number, droppableId: string) => {
    const completedSubs = task.subtasks.filter((s) => s.completed).length;
    const totalSubs = task.subtasks.length;
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
              "rounded-xl border border-border transition-shadow",
              isDone ? "bg-success/10 border-success/30" : "bg-card",
              snapshot.isDragging && "shadow-lg"
            )}
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
                  <MessageSquare className="h-3 w-3 text-primary animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "text-sm font-medium",
                  isDone ? "text-success line-through" : "text-foreground"
                )}>
                  {task.title}
                </span>
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  {totalSubs > 0 && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {completedSubs}/{totalSubs}
                      </span>
                    </div>
                  )}
                  {task.createdBy && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border">
                      <UserIcon className="h-2.5 w-2.5" />
                      <span className="truncate max-w-[120px]">{task.createdBy}</span>
                    </div>
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
                {/* Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" /> Notas
                  </div>
                  <Textarea
                    value={task.notes}
                    onChange={(e) =>
                      updateTask(task.id, { notes: e.target.value })
                    }
                    placeholder="Agregar notas..."
                    className="min-h-[60px] text-sm resize-none"
                  />
                </div>

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
                          onChange={() =>
                            toggleSubtask(task.id, sub.id)
                          }
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <input
                          value={sub.title}
                          onChange={(e) =>
                            updateSubtaskTitle(
                              task.id,
                              sub.id,
                              e.target.value
                            )
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
              </div>
            )}
          </div>
        )
        }
      </Draggable >
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Operaciones</h1>
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
          <TabsTrigger value="files" className="gap-2">
            <FileText className="h-4 w-4" />
            Archivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6 mt-0">
          {/* Add task */}
          <div className="flex gap-2">
            <Input
              placeholder="Título de nueva tarea..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1"
            />
            <select
              value={newTaskDept}
              onChange={(e) => setNewTaskDept(e.target.value)}
              className="h-10 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button onClick={addTask} className="gap-1.5">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
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
            <div className="grid gap-6 lg:grid-cols-2">
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

        <TabsContent value="files" className="mt-0">
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border bg-muted/30">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Módulo de Archivos</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
              El contenido de esta sección se subirá próximamente. Aquí podrás gestionar los documentos del equipo.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Operations;


