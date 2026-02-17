import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  expanded: boolean;
  userId: string;
  createdAt: any;
}

const priorities = ["Baja", "Media", "Alta", "Urgente"];

const priorityColor: Record<string, string> = {
  Baja: "bg-muted text-muted-foreground",
  Media: "bg-info/15 text-info",
  Alta: "bg-warning/15 text-warning",
  Urgente: "bg-destructive/15 text-destructive",
};

const Tasks = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Media");
  const [loading, setLoading] = useState(true);

  // Fetch private tasks from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "user_tasks"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];

      // Sort in memory to avoid needing a composite index in Firestore
      const sortedDocs = [...docs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setTasks(sortedDocs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      toast.error("Error al cargar tus tareas");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

    try {
      const newTaskData = {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        status: "todo",
        notes: "",
        subtasks: [],
        expanded: false,
        userId: user.uid,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "user_tasks"), newTaskData);
      setNewTaskTitle("");
      toast.success("Tarea agregada");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Error al guardar la tarea");
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

  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const sourceList = source.droppableId;
      const destList = destination.droppableId;

      if (sourceList !== destList) {
        // Find the task in the respective localized list
        const sourceArr = sourceList === "pending" ? pendingTasks : completedTasks;
        const movedTask = sourceArr[source.index];

        if (movedTask) {
          updateTask(movedTask.id, {
            status: destList === "completed" ? "done" : "todo"
          });
        }
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
              <button onClick={() => toggleExpand(task.id)} className="text-muted-foreground">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm font-medium", isDone ? "text-success line-through" : "text-foreground")}>
                  {task.title}
                </span>
                {totalSubs > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {completedSubs}/{totalSubs}
                    </span>
                  </div>
                )}
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", priorityColor[task.priority] || "bg-muted text-muted-foreground")}>
                {task.priority}
              </span>
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
      </div>

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
