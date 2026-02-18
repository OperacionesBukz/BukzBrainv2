import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Circle,
  ListChecks,
  BookOpen,
  CalendarDays,
  ArrowRight,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const priorityColor: Record<string, string> = {
  Baja: "bg-muted text-muted-foreground border-transparent",
  Media: "bg-info/15 text-info border-info/20",
  Alta: "bg-warning/15 text-amber-700 dark:text-warning border-warning/20",
  Urgente: "bg-destructive/15 text-destructive border-destructive/20",
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

interface DevTask {
  id: string;
  title: string;
  department: string;
  status: string;
  createdBy?: string;
  createdAt: any;
  dueDate?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [devTasks, setDevTasks] = useState<DevTask[]>([]);
  const [counts, setCounts] = useState({ tasks: 0, requests: 0, operations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const taskMap = new Map<string, Task>();

    const tasksOwnQuery = query(
      collection(db, "user_tasks"),
      where("userId", "==", user.uid),
      where("status", "==", "todo")
    );

    const tasksAssignedQuery = query(
      collection(db, "user_tasks"),
      where("assignedTo", "==", user.email),
      where("status", "==", "todo")
    );

    const processTasksSnapshot = () => {
      const allTasks = Array.from(taskMap.values());
      const sorted = [...allTasks].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setTasks(sorted.slice(0, 5));
      setCounts(prev => ({ ...prev, tasks: allTasks.length }));
      setLoading(false);
    };

    const unsubscribeTasks1 = onSnapshot(tasksOwnQuery, (snapshot) => {
      snapshot.docs.forEach(doc => {
        taskMap.set(doc.id, { id: doc.id, ...doc.data() } as Task);
      });
      const ownIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((task, key) => {
        if (!task.assignedTo && !ownIds.has(key)) taskMap.delete(key);
      });
      processTasksSnapshot();
    });

    const unsubscribeTasks2 = onSnapshot(tasksAssignedQuery, (snapshot) => {
      const assignedIds = new Set(snapshot.docs.map(d => d.id));
      taskMap.forEach((task, key) => {
        if (task.assignedTo === user.email && !assignedIds.has(key)) taskMap.delete(key);
      });
      snapshot.docs.forEach(doc => {
        taskMap.set(doc.id, { id: doc.id, ...doc.data() } as Task);
      });
      processTasksSnapshot();
    });

    const requestsQuery = query(
      collection(db, "leave_requests"),
      where("userId", "==", user.uid)
    );
    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setCounts(prev => ({ ...prev, requests: snapshot.size }));
    });

    const opsQuery = query(
      collection(db, "tasks"),
      where("status", "!=", "done")
    );
    const unsubscribeOps = onSnapshot(opsQuery, (snapshot) => {
      setCounts(prev => ({ ...prev, operations: snapshot.size }));
    });

    // Tareas de Operaciones categorizadas como Devolución
    const devTasksQuery = query(
      collection(db, "tasks"),
      where("department", "==", "Devolución")
    );
    const unsubscribeDevTasks = onSnapshot(devTasksQuery, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DevTask))
        .filter(task => task.status !== "done")
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
      setDevTasks(docs);
    });

    return () => {
      unsubscribeTasks1();
      unsubscribeTasks2();
      unsubscribeRequests();
      unsubscribeOps();
      unsubscribeDevTasks();
    };
  }, [user]);

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
          <h2 className="text-xl font-semibold text-foreground mb-4">Devoluciones Activas</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {devTasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground italic">
                No hay devoluciones activas.
              </div>
            ) : (
              devTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center px-5 py-3.5 transition-theme hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <Circle className="h-2.5 w-2.5 text-muted-foreground flex-none" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{task.title}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {task.createdBy && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <UserIcon className="h-2.5 w-2.5" />
                            <span>{task.createdBy.split("@")[0]}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                            <CalendarDays className="h-2.5 w-2.5" />
                            <span>Límite: {format(new Date(task.dueDate + "T00:00:00"), "dd MMM", { locale: es })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            {devTasks.length > 0 && (
              <button
                onClick={() => navigate("/operations")}
                className="w-full py-3 px-5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-muted/50 border-t border-border transition-colors flex items-center justify-center gap-2"
              >
                Ver en Operaciones <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
