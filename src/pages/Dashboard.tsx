import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  ListChecks,
  BookOpen,
  CalendarDays,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  Package,
  User as UserIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const priorityColor: Record<string, string> = {
  Baja: "bg-muted text-muted-foreground border-transparent",
  Media: "bg-info/15 text-info border-info/20",
  Alta: "bg-warning/15 text-amber-700 dark:text-warning border-warning/20",
  Urgente: "bg-destructive/15 text-destructive border-destructive/20",
};

const returnTypeColor: Record<string, string> = {
  Vacaciones: "bg-info/15 text-info",
  "Permiso Remunerado": "bg-warning/15 text-warning",
  "Día de Cumpleaños": "bg-primary/15 text-primary",
};

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: any;
  assignedTo?: string;
  assignedBy?: string;
}

interface SupplierReturn {
  id: string;
  provider: string;
  deliveryDate: string;
  createdAt: any;
  createdBy: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [counts, setCounts] = useState({ tasks: 0, requests: 0, operations: 0 });
  const [loading, setLoading] = useState(true);
  const [newReturn, setNewReturn] = useState({ provider: "", deliveryDate: "" });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [showAddReturn, setShowAddReturn] = useState(false);

  const isAuthorized = user?.email === "cedi@bukz.co" || user?.email === "operaciones@bukz.co";

  useEffect(() => {
    if (!user) return;

    const taskMap = new Map<string, Task>();

    // Real-time personal tasks (created by me)
    const tasksOwnQuery = query(
      collection(db, "user_tasks"),
      where("userId", "==", user.uid),
      where("status", "==", "todo")
    );

    // Real-time assigned tasks (assigned to me)
    const tasksAssignedQuery = query(
      collection(db, "user_tasks"),
      where("assignedTo", "==", user.email),
      where("status", "==", "todo")
    );

    const processTasksSnapshot = () => {
      const allTasks = Array.from(taskMap.values());
      // Sort in memory to avoid index requirement for composite query
      const sorted = [...allTasks].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      // Limit to top 5
      setTasks(sorted.slice(0, 5));
      setCounts(prev => ({ ...prev, tasks: allTasks.length }));
      setLoading(false);
    };

    const unsubscribeTasks1 = onSnapshot(tasksOwnQuery, (snapshot) => {
      snapshot.docs.forEach(doc => {
        taskMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Task);
      });
      // Remove deleted own tasks
      const ownIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((task, key) => {
        if (!task.assignedTo && !ownIds.has(key)) taskMap.delete(key);
      });
      processTasksSnapshot();
    });

    const unsubscribeTasks2 = onSnapshot(tasksAssignedQuery, (snapshot) => {
      // Remove old assigned tasks not in this snapshot
      const assignedIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((task, key) => {
        if (task.assignedTo === user.email && !assignedIds.has(key)) taskMap.delete(key);
      });
      snapshot.docs.forEach(doc => {
        taskMap.set(doc.id, {
          id: doc.id,
          ...doc.data()
        } as Task);
      });
      processTasksSnapshot();
    });

    // Count personal requests
    const requestsQuery = query(
      collection(db, "leave_requests"),
      where("userId", "==", user.uid)
    );
    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setCounts(prev => ({ ...prev, requests: snapshot.size }));
    });

    // Count operations tasks (pending only)
    const opsQuery = query(
      collection(db, "tasks"),
      where("status", "!=", "done")
    );
    const unsubscribeOps = onSnapshot(opsQuery, (snapshot) => {
      setCounts(prev => ({ ...prev, operations: snapshot.size }));
    });

    // Real-time returns
    const returnsQuery = query(
      collection(db, "supplier_returns"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsubscribeReturns = onSnapshot(returnsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupplierReturn[];
      setReturns(docs);
    });

    return () => {
      unsubscribeTasks1();
      unsubscribeTasks2();
      unsubscribeRequests();
      unsubscribeOps();
      unsubscribeReturns();
    };
  }, [user]);

  const handleAddReturn = async () => {
    if (!newReturn.provider.trim() || !newReturn.deliveryDate.trim()) {
      toast.error("Por favor completa los campos de la devolución");
      return;
    }

    setIsSubmittingReturn(true);
    try {
      await addDoc(collection(db, "supplier_returns"), {
        provider: newReturn.provider.trim(),
        deliveryDate: newReturn.deliveryDate.trim(),
        createdBy: user?.email,
        createdAt: serverTimestamp(),
      });
      setNewReturn({ provider: "", deliveryDate: "" });
      toast.success("Devolución agregada correctamente");
    } catch (error: any) {
      console.error("Error adding return:", error);
      toast.error("Error al agregar devolución");
    } finally {
      setIsSubmittingReturn(false);
      setShowAddReturn(false);
    }
  };

  const handleDeleteReturn = async (id: string) => {
    try {
      await deleteDoc(doc(db, "supplier_returns", id));
      toast.success("Devolución eliminada");
    } catch (error) {
      console.error("Error deleting return:", error);
      toast.error("Error al eliminar la devolución");
    }
  };

  const modules = [
    {
      title: "Operaciones",
      description: "Gestionar tareas entre departamentos",
      icon: ListChecks,
      path: "/operations",
      count: counts.operations,
      label: "tareas",
    },
    {
      title: "Tareas",
      description: "Gestor de tareas personal",
      icon: ClipboardList,
      path: "/tasks",
      count: counts.tasks,
      label: "pendientes",
    },
    {
      title: "Guías",
      description: "Base de conocimiento",
      icon: BookOpen,
      path: "/instructions",
      count: 5,
      label: "guías",
    },
    {
      title: "Solicitudes",
      description: "Permisos y vacaciones",
      icon: CalendarDays,
      path: "/requests",
      count: counts.requests,
      label: "solicitudes",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Bienvenido</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Esto es lo que está pasando en tu organización.
        </p>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((mod) => (
          <button
            key={mod.path}
            onClick={() => navigate(mod.path)}
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <mod.icon className="h-6 w-6 text-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {mod.count} {mod.label}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-medium text-foreground">{mod.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {mod.description}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-theme">
              Abrir <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Mis Tareas Activas</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                Cargando tareas...
              </div>
            ) : tasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No tienes tareas pendientes. ¡Buen trabajo!
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-theme hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <Circle className="h-2.5 w-2.5 text-muted-foreground flex-none" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{task.title}</span>
                      {task.assignedBy && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <UserIcon className="h-2.5 w-2.5" />
                          <span className="truncate">Asignada por {task.assignedBy.split("@")[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-none">
                    <span className={cn(
                      "text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border",
                      priorityColor[task.priority] || "bg-muted text-muted-foreground"
                    )}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))
            )}
            {!loading && tasks.length > 0 && (
              <button
                onClick={() => navigate("/tasks")}
                className="w-full py-3 px-5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-muted/50 border-t border-border transition-colors flex items-center justify-center gap-2"
              >
                Ver todas las tareas <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Devoluciones Activas</h2>
            {isAuthorized && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddReturn(!showAddReturn)}
                className={cn(
                  "h-8 w-8 rounded-full p-0 flex items-center justify-center transition-all duration-300",
                  showAddReturn
                    ? "bg-destructive/10 border-destructive/20 hover:bg-destructive/20"
                    : "border-primary/20 hover:border-primary/50"
                )}
                title={showAddReturn ? "Cerrar" : "Agregar devolución"}
              >
                {showAddReturn ? (
                  <Minus className="h-4 w-4 text-destructive" />
                ) : (
                  <Plus className="h-4 w-4 text-primary" />
                )}
              </Button>
            )}
          </div>
          <div className="space-y-4">
            {isAuthorized && showAddReturn && (
              <div className="flex flex-col gap-3 bg-card p-4 rounded-xl border border-primary/20 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del Proveedor..."
                    value={newReturn.provider}
                    onChange={(e) => setNewReturn(prev => ({ ...prev, provider: e.target.value }))}
                    className="flex-1 text-sm h-10"
                  />
                  <Input
                    type="date"
                    value={newReturn.deliveryDate}
                    onChange={(e) => setNewReturn(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    className="w-40 text-sm h-10"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddReturn(false)}
                    className="text-xs h-8"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddReturn}
                    disabled={isSubmittingReturn}
                    className="text-xs h-8 px-4"
                  >
                    {isSubmittingReturn ? "Agregando..." : "Guardar Devolución"}
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {returns.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                  No hay devoluciones activas.
                </div>
              ) : (
                returns.map((ret) => (
                  <div
                    key={ret.id}
                    className="flex items-center justify-between px-5 py-3.5 transition-theme hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Package className="h-4 w-4 text-muted-foreground flex-none" />
                      <div>
                        <span className="text-sm font-medium text-foreground block truncate">{ret.provider}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                            <CalendarDays className="h-2.5 w-2.5" />
                            <span>Entrega: {ret.deliveryDate}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            por {ret.createdBy?.split("@")[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAuthorized && (
                      <button
                        onClick={() => handleDeleteReturn(ret.id)}
                        className="text-muted-foreground hover:text-destructive transition-theme p-1.5 hover:bg-destructive/10 rounded-lg flex-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
