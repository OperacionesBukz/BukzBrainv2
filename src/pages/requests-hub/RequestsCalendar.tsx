import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  parseISO,
  eachDayOfInterval,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { LeaveRequest, requestTypeConfig } from "../requests/types";

interface RequestsCalendarProps {
  requests: LeaveRequest[];
}

const statusConfig = {
  approved: {
    label: "Aprobado",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500",
  },
  pending: {
    label: "Pendiente",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-600 border-amber-200",
    chipClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-l-2 border-amber-500",
  },
  rejected: {
    label: "Rechazado",
    dotClass: "bg-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    chipClass: "bg-destructive/15 text-destructive border-l-2 border-destructive",
  },
} as const;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function buildRequestsByDate(requests: LeaveRequest[]) {
  const map = new Map<string, LeaveRequest[]>();
  for (const req of requests) {
    try {
      const start = parseISO(req.startDate);
      const end = parseISO(req.endDate);
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        const key = format(day, "yyyy-MM-dd");
        const existing = map.get(key) || [];
        existing.push(req);
        map.set(key, existing);
      }
    } catch {
      // skip malformed dates
    }
  }
  return map;
}

function RequestChip({ request }: { request: LeaveRequest }) {
  const sc = statusConfig[request.status];
  const typeConf = requestTypeConfig.find((t) => t.value === request.type);
  const Icon = typeConf?.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-r-sm text-[10px] leading-tight truncate",
        sc?.chipClass
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate font-medium">
        {request.fullName?.split(" ")[0] || request.userEmail.split("@")[0]}
      </span>
    </div>
  );
}

function ChipPopoverDetail({ request }: { request: LeaveRequest }) {
  const sc = statusConfig[request.status];
  const typeConf = requestTypeConfig.find((t) => t.value === request.type);
  const Icon = typeConf?.icon;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="font-medium">{request.fullName || request.userEmail}</span>
      </div>
      <div className="text-muted-foreground text-xs space-y-1">
        <p>{request.type === 'custom' ? request.customTypeLabel || 'Personalizado' : typeConf?.label}</p>
        <p>
          {format(parseISO(request.startDate), "d MMM", { locale: es })} –{" "}
          {format(parseISO(request.endDate), "d MMM yyyy", { locale: es })}
        </p>
      </div>
      <Badge variant="outline" className={cn("text-xs", sc?.badgeClass)}>
        {sc?.label}
      </Badge>
    </div>
  );
}

function DayCell({
  date,
  currentMonth,
  requestsByDate,
  isMobile,
  isFullscreen,
}: {
  date: Date;
  currentMonth: Date;
  requestsByDate: Map<string, LeaveRequest[]>;
  isMobile: boolean;
  isFullscreen: boolean;
}) {
  const key = format(date, "yyyy-MM-dd");
  const dayRequests = requestsByDate.get(key) || [];
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const maxChips = isFullscreen ? 4 : isMobile ? 1 : 2;
  const visibleChips = dayRequests.slice(0, maxChips);
  const overflow = dayRequests.length - maxChips;

  return (
    <div
      className={cn(
        "border border-border/50 p-1 flex flex-col gap-0.5 transition-colors",
        isFullscreen ? "min-h-0 h-full" : "min-h-[80px] md:min-h-[110px]",
        !isCurrentMonth && "bg-muted/30",
        today && "bg-accent/30 ring-1 ring-accent ring-inset"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium self-end w-6 h-6 flex items-center justify-center rounded-full",
          !isCurrentMonth && "text-muted-foreground/50",
          today && "bg-primary text-primary-foreground"
        )}
      >
        {date.getDate()}
      </span>

      <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
        {visibleChips.map((req) => (
          <Popover key={req.id}>
            <PopoverTrigger asChild>
              <button className="w-full text-left cursor-pointer hover:opacity-80 transition-opacity">
                <RequestChip request={req} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64" side="right" align="start">
              <ChipPopoverDetail request={req} />
            </PopoverContent>
          </Popover>
        ))}

        {overflow > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1.5 cursor-pointer transition-colors">
                +{overflow} más
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72" side="right" align="start">
              <div className="space-y-3 max-h-60 overflow-y-auto">
                <p className="font-medium text-sm text-muted-foreground">
                  {format(date, "d 'de' MMMM, yyyy", { locale: es })}
                </p>
                {dayRequests.map((req) => {
                  const typeConf = requestTypeConfig.find((t) => t.value === req.type);
                  const Icon = typeConf?.icon;
                  const sc = statusConfig[req.status];
                  return (
                    <div key={req.id} className="flex items-center gap-2 text-sm">
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate flex-1 font-medium">
                        {req.fullName || req.userEmail}
                      </span>
                      <Badge variant="outline" className={cn("text-xs shrink-0", sc?.badgeClass)}>
                        {sc?.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default function RequestsCalendar({ requests }: RequestsCalendarProps) {
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const requestsByDate = useMemo(() => buildRequestsByDate(requests), [requests]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touchStartRef.current.x - touch.clientX;
      const deltaY = Math.abs(touchStartRef.current.y - touch.clientY);
      touchStartRef.current = null;

      if (Math.abs(deltaX) > 50 && deltaY < 30) {
        if (deltaX > 0) {
          setCurrentMonth((m) => addMonths(m, 1)); // swipe left → next
        } else {
          setCurrentMonth((m) => subMonths(m, 1)); // swipe right → prev
        }
      }
    },
    []
  );

  const calendarContent = (
    <div className={cn("space-y-4", isFullscreen && "min-h-full flex flex-col")}>
      {/* Header: navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        className={cn(
          "rounded-lg border bg-card",
          isFullscreen ? "flex-1 flex flex-col overflow-visible" : "overflow-hidden"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2 border-b border-border/50"
            >
              {isMobile && !isFullscreen ? day.charAt(0) : day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          className={cn("grid grid-cols-7", isFullscreen && "flex-1")}
          style={isFullscreen ? { gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, 1fr)` } : undefined}
        >
          {calendarDays.map((date) => (
            <DayCell
              key={date.toISOString()}
              date={date}
              currentMonth={currentMonth}
              requestsByDate={requestsByDate}
              isMobile={isMobile}
              isFullscreen={isFullscreen}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        {Object.entries(statusConfig).map(([key, conf]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", conf.dotClass)} />
            {conf.label}
          </div>
        ))}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background p-4 md:p-6 overflow-hidden">
        {calendarContent}
      </div>
    );
  }

  return calendarContent;
}
