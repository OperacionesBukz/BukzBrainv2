import { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerButton } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
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
import { Task, SubTask, departments } from "./operations/types";
import OperationsTaskCard from "./operations/OperationsTaskCard";


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
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [isTaskFormClosing, setIsTaskFormClosing] = useState(false);
  const [filterDept, setFilterDept] = useState("All");

  const closeTaskForm = () => {
    if (!showNewTaskForm || isTaskFormClosing) return;
    setIsTaskFormClosing(true);
    setNewTaskTitle("");
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

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const newTaskData: Record<string, any> = {
        title: newTaskTitle.trim(),
        department: newTaskDept,
        status: "todo",
        notes: "",
        subtasks: [],
        createdBy: user?.email || "Usuario desconocido",
        createdAt: serverTimestamp(),
        order: Date.now(),
      };
      if (newStartDate) newTaskData.startDate = format(newStartDate, "yyyy-MM-dd");
      if (newDueDate) newTaskData.dueDate = format(newDueDate, "yyyy-MM-dd");
      await addDoc(collection(db, "tasks"), newTaskData);
      setNewTaskTitle("");
      setNewStartDate("");
      setNewDueDate("");
      setShowNewTaskForm(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Tareas Bukz</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Gestión de tareas entre áreas
        </p>
      </div>

      <div className="space-y-6">
          {/* Add task */}
          <div>
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
                {/* Fila 1: Input título + Select departamento */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Input
                    placeholder="Título de la tarea..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    autoFocus
                    className="h-8 text-sm px-3 flex-1 min-w-0"
                  />
                  <select
                    value={newTaskDept}
                    onChange={(e) => setNewTaskDept(e.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground shrink-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
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
                    onClick={addTask}
                    disabled={!newTaskTitle.trim()}
                    className="h-7 text-xs px-3 gap-1 shrink-0"
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {["All", ...departments].map((d) => (
              <button
                key={d}
                onClick={() => setFilterDept(d)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-theme border",
                  filterDept === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground hover:bg-secondary border-border"
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
                      {pendingTasks.map((task, index) => (
                        <OperationsTaskCard
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
                          departments={departments}
                        />
                      ))}
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
                      {completedTasks.map((task, index) => (
                        <OperationsTaskCard
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
                          departments={departments}
                        />
                      ))}
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
      </div>
    </div>
  );
};

export default Operations;
