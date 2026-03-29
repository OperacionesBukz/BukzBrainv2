import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/notifications";
import type { Notification } from "@/lib/notifications";

function formatRelativeTime(notification: Notification): string {
  if (!notification.createdAt) return "";
  const date = notification.createdAt.toDate();
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, loading } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    if (notification.resourcePath) {
      navigate(notification.resourcePath);
    }
    setOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.email) return;
    await markAllNotificationsAsRead(user.email);
  };

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {badgeLabel}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar todas como leidas
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No tienes notificaciones
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !notification.read && "bg-muted/30"
                  )}
                >
                  {/* Unread indicator */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        notification.read
                          ? "bg-transparent"
                          : "bg-blue-500"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className="text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {formatRelativeTime(notification)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
