import { format } from "date-fns";
import { Draggable } from "@hello-pangea/dnd";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  MessageSquare,
  Circle,
  CheckCircle2,
  User as UserIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DatePickerButton } from "@/components/ui/date-picker";
import { Task, priorities, priorityColor, formatDate, toDate } from "./types";

interface TaskCardProps {
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
}

const TaskCard = ({
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
}: TaskCardProps) => {
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

export default TaskCard;
