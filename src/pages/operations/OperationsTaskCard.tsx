import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Draggable } from "@hello-pangea/dnd";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  MessageSquare,
  Circle,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { StringDatePicker } from "@/components/ui/date-picker";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Task } from "./types";

interface OperationsTaskCardProps {
  task: Task;
  index: number;
  expandedTasks: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  updateSubtaskTitle: (taskId: string, subtaskId: string, title: string) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  departments: string[];
}

const OperationsTaskCard = ({
  task,
  index,
  expandedTasks,
  toggleExpand,
  updateTask,
  deleteTask,
  addSubtask,
  toggleSubtask,
  updateSubtaskTitle,
  deleteSubtask,
  departments,
}: OperationsTaskCardProps) => {
  const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubs = task.subtasks?.length || 0;
  const progress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;
  const devItems = task.devolucionItems ?? [];
  const recibidosCount = devItems.filter((i) => i.recibido).length;

  const toggleItemRecibido = async (itemIndex: number) => {
    if (!task.devolucionItems) return;
    const updated = task.devolucionItems.map((item, i) =>
      i === itemIndex ? { ...item, recibido: !item.recibido } : item
    );
    await updateTask(task.id, { devolucionItems: updated } as Partial<Task>);
  };
  const isDone = task.status === "done";
  const isExpanded = expandedTasks[task.id];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = task.dueDate ? (new Date(task.dueDate + "T00:00:00") < today && !isDone) : false;
  const formatDate = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM", { locale: es });

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
                {(task.startDate || task.dueDate) && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border",
                    isOverdue
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : "text-muted-foreground bg-muted/50 border-border"
                  )}>
                    <Calendar className="h-2.5 w-2.5" />
                    <span>
                      {task.startDate && formatDate(task.startDate)}
                      {task.startDate && task.dueDate && " → "}
                      {task.dueDate && formatDate(task.dueDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <select
              value={task.department}
              onChange={(e) => updateTask(task.id, { department: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0 cursor-pointer border border-border outline-none focus:ring-1 focus:ring-ring appearance-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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

              {/* Devolucion Items */}
              {devItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PackageCheck className="h-3 w-3" /> Items Devolución ({recibidosCount}/{devItems.length} recibidos)
                    </div>
                  </div>
                  <div className="rounded border overflow-auto max-h-[250px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="w-8 px-2 py-1" />
                          <th className="text-left px-2 py-1">#</th>
                          <th className="text-left px-2 py-1">ISBN</th>
                          <th className="text-left px-2 py-1">Título</th>
                          <th className="text-right px-2 py-1">Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devItems.map((item, idx) => (
                          <tr
                            key={item.fila}
                            className={cn("border-t", item.recibido && "bg-success/10")}
                          >
                            <td className="px-2 py-1">
                              <Checkbox
                                checked={item.recibido}
                                onCheckedChange={() => toggleItemRecibido(idx)}
                              />
                            </td>
                            <td className="px-2 py-1">{item.fila}</td>
                            <td className="px-2 py-1 font-mono">{item.isbn ?? "—"}</td>
                            <td className={cn("px-2 py-1", item.recibido && "line-through text-muted-foreground")}>
                              {item.titulo ?? "—"}
                            </td>
                            <td className="px-2 py-1 text-right">{item.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: {devItems.reduce((s, i) => s + i.cantidad, 0)} unidades
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Fechas
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap w-10">Inicio</label>
                    <StringDatePicker
                      value={task.startDate || ""}
                      onChange={(val) => updateTask(task.id, { startDate: val || undefined })}
                      className={cn("h-8 flex-1 text-xs")}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <label className={cn("text-xs whitespace-nowrap w-10", isOverdue ? "text-destructive" : "text-muted-foreground")}>Límite</label>
                    <StringDatePicker
                      value={task.dueDate || ""}
                      onChange={(val) => updateTask(task.id, { dueDate: val || undefined })}
                      className={cn(
                        "h-8 flex-1 text-xs",
                        isOverdue && "border-destructive/50 bg-destructive/5 text-destructive"
                      )}
                    />
                  </div>
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

export default OperationsTaskCard;
