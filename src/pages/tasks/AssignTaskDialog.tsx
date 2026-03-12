import {
  Plus,
  Trash2,
  MessageSquare,
  UserPlus,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DatePickerButton } from "@/components/ui/date-picker";
import { SubTask, priorities, assignableUsers } from "./types";

interface AssignTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignTitle: string;
  setAssignTitle: (v: string) => void;
  assignPriority: string;
  setAssignPriority: (v: string) => void;
  assignTo: string;
  setAssignTo: (v: string) => void;
  assignNotes: string;
  setAssignNotes: (v: string) => void;
  assignSubtasks: SubTask[];
  setAssignSubtasks: (v: SubTask[]) => void;
  assignStartDate: Date | undefined;
  setAssignStartDate: (v: Date | undefined) => void;
  assignDueDate: Date | undefined;
  setAssignDueDate: (v: Date | undefined) => void;
  assignTask: () => Promise<void>;
  userEmail: string | undefined;
}

const AssignTaskDialog = ({
  open,
  onOpenChange,
  assignTitle,
  setAssignTitle,
  assignPriority,
  setAssignPriority,
  assignTo,
  setAssignTo,
  assignNotes,
  setAssignNotes,
  assignSubtasks,
  setAssignSubtasks,
  assignStartDate,
  setAssignStartDate,
  assignDueDate,
  setAssignDueDate,
  assignTask,
  userEmail,
}: AssignTaskDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  .filter(u => u.email !== userEmail)
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={assignTask} disabled={!assignTitle.trim() || !assignTo}>
            <UserPlus className="h-4 w-4 mr-2" /> Asignar Tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignTaskDialog;
