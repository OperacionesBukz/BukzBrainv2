import { ReactNode, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import logoSrc from "@/assets/LOGO_BUKZ.png";
import {
  Home,
  ListChecks,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Menu,
  LogOut,
  Store,
  ShieldCheck,
  UserPlus,
  Settings,
  ChevronDown,
  HelpCircle,
  Package,
  Ship,
  ClipboardCheck,
  Calculator,
  PackageSearch,
  SearchCode,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigationPermissions } from "@/hooks/useNavigationPermissions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useTour } from "@/hooks/useTour";
import { ChatBubble } from "@/components/agent/ChatBubble";

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: Home, tourId: "nav-dashboard" },
  { title: "Tareas Bukz", path: "/operations", icon: ListChecks, tourId: "nav-operations" },
  { title: "Tareas", path: "/tasks", icon: ClipboardList, tourId: "nav-tasks" },
  { title: "Guías", path: "/instructions", icon: BookOpen, tourId: "nav-instructions" },
  { title: "Solicitudes", path: "/requests", icon: CalendarDays, tourId: "nav-requests" },
  { title: "Solicitud Librerías", path: "/bookstore-requests", icon: Store, tourId: "nav-bookstore" },
  { title: "Hub Solicitudes", path: "/requests-hub", icon: ClipboardCheck, tourId: "nav-requests-hub" },
  { title: "Reposición", path: "/reposicion", icon: Package, tourId: "nav-reposicion" },
  { title: "Celesa", path: "/celesa", icon: Ship, tourId: "nav-celesa" },
  { title: "Ingreso Mercancía", path: "/ingreso", icon: PackageSearch, tourId: "nav-ingreso" },
  { title: "Scrap Bukz", path: "/scrap", icon: SearchCode, tourId: "nav-scrap" },
  { title: "Calculadora", path: "/calculator", icon: Calculator, tourId: "nav-calculator" },
];

const adminSubItems = [
  { title: "Permisos Navegación", path: "/nav-admin", icon: ShieldCheck },
  { title: "Gestión Usuarios", path: "/user-admin", icon: UserPlus },
];

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(() => window.location.pathname.startsWith("/nav-admin") || window.location.pathname.startsWith("/user-admin"));
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const { allowedPages, allowedWorkspaces, loaded } = useNavigationPermissions();
  const { workspace, switchWorkspace } = useWorkspace();

  // Force fallback to "general" if user doesn't have access to current workspace
  useEffect(() => {
    if (loaded && workspace.id === "operaciones" && !allowedWorkspaces.has("operaciones")) {
      switchWorkspace("general");
    }
  }, [loaded, workspace.id, allowedWorkspaces, switchWorkspace]);

  const { startTour } = useTour(allowedPages);
  const [tourDialogOpen, setTourDialogOpen] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Filter nav items: must be in workspace AND allowed by permissions
  const visibleNavItems = navItems.filter(
    (item) => workspace.paths.includes(item.path) && allowedPages.has(item.path)
  );

  // Redirect if current route doesn't belong to the active workspace
  useEffect(() => {
    if (loading || !user) return;
    const currentPath = location.pathname;
    const isInWorkspace = workspace.paths.includes(currentPath);
    const isAdminPath = currentPath.startsWith("/nav-admin") || currentPath.startsWith("/user-admin");
    if (!isInWorkspace && !isAdminPath) {
      const firstAvailable = visibleNavItems[0]?.path ?? workspace.paths[0];
      if (firstAvailable) navigate(firstAvailable, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const userDisplayName =
    user?.displayName || user?.email?.split("@")[0] || "Usuario";
  const userInitials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar - solo desktop */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-sidebar transition-all duration-300",
          isMobile ? "hidden" : (collapsed ? "w-16" : "w-60")
        )}
      >
        {/* Nav push down to go under header */}
        <div className="h-14 shrink-0" />
        {/* Workspace Switcher */}
        <div className="px-2 pt-3 pb-1 border-b border-border/40">
          <WorkspaceSwitcher current={workspace} onSwitch={switchWorkspace} collapsed={collapsed} allowedWorkspaces={allowedWorkspaces} />
        </div>
        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 pt-4">
          {visibleNavItems
            .map((item) => {
              const isActive = location.pathname === item.path;
              const hasSubItems = !!item.subItems && !collapsed;
              const isExpanded = expandedPaths.has(item.path);

              return (
                <div key={item.path} className="space-y-1">
                  {hasSubItems ? (
                    <button
                      id={item.tourId}
                      onClick={() => {
                        setExpandedPaths((prev) => {
                          const next = new Set(prev);
                          next.has(item.path) ? next.delete(item.path) : next.add(item.path);
                          return next;
                        });
                        navigate(item.path);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                        isActive
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          isActive && "text-foreground"
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.title}</span>
                          <ChevronDown className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )} />
                        </>
                      )}
                    </button>
                  ) : (
                    <NavLink
                      to={item.path}
                      id={item.tourId}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                        isActive
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          isActive && "text-foreground"
                        )}
                      />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  )}

                  {hasSubItems && isExpanded && item.subItems && (
                    <div className="ml-9 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      {item.subItems.map((sub) => {
                        const isSubActive =
                          location.pathname + location.search === sub.path ||
                          (sub.path === "/operations?tab=tasks" &&
                            location.pathname === "/operations" &&
                            !location.search);

                        return (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
                              isSubActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5"
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5 transition-transform duration-200" />
                            <span>{sub.title}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Separador visual después de nav items */}
          <div className="border-b border-border/40 pb-3" />

          {/* Admin — solo administradores */}
          {isAdmin && workspace.showAdmin && (
            <div className="mt-2 pt-3">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                  adminSubItems.some(s => location.pathname === s.path)
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0 transition-transform duration-200" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Admin</span>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      adminOpen && "rotate-180"
                    )} />
                  </>
                )}
              </button>
              {adminOpen && !collapsed && (
                <div className="ml-9 space-y-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {adminSubItems.map((sub) => (
                    <NavLink
                      key={sub.path}
                      to={sub.path}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
                        location.pathname === sub.path
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5"
                      )}
                    >
                      <sub.icon className="h-3.5 w-3.5 transition-transform duration-200" />
                      <span>{sub.title}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-2">
          <div id="sidebar-theme" className="flex items-center justify-between px-2">
            {!collapsed && <ThemeToggle />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-9 w-9 rounded-lg"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer menu */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="w-72 p-0 bg-sidebar"
            style={{
              paddingTop: 'env(safe-area-inset-top)'
            }}
          >
            <div className="flex flex-col h-full bg-sidebar">
              {/* Logo header dentro del drawer */}
              <div
                className="flex items-baseline px-4 border-b border-border/40"
                style={{
                  height: 'calc(3.5rem + env(safe-area-inset-top))',
                  paddingTop: 'env(safe-area-inset-top)'
                }}
              >
                <img src={logoSrc} alt="BUKZ" className="h-7 object-contain dark:invert" />
                <span className="ml-2 text-lg font-bold tracking-tight -mb-0.5">
                  <span className="text-primary italic">Brain</span>
                </span>
              </div>

              {/* Workspace Switcher - mobile */}
              <div className="px-2 pt-3 pb-1 border-b border-border/40">
                <WorkspaceSwitcher current={workspace} onSwitch={switchWorkspace} allowedWorkspaces={allowedWorkspaces} />
              </div>

              {/* Navegación - mismo contenido que sidebar */}
              <nav className="flex-1 space-y-1 p-2 pt-4 overflow-y-auto">
                {visibleNavItems
                  .map((item) => {
                    const isActive = location.pathname === item.path;
                    const hasSubItems = !!item.subItems;
                    const isExpanded = expandedPaths.has(item.path);

                    return (
                      <div key={item.path} className="space-y-1">
                        {hasSubItems ? (
                          <button
                            onClick={() => {
                              setExpandedPaths((prev) => {
                                const next = new Set(prev);
                                next.has(item.path) ? next.delete(item.path) : next.add(item.path);
                                return next;
                              });
                              navigate(item.path);
                              setMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                              isActive
                                ? "bg-primary/15 text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200" />
                            <span className="flex-1 text-left">{item.title}</span>
                            <ChevronDown className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )} />
                          </button>
                        ) : (
                          <NavLink
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                              isActive
                                ? "bg-primary/15 text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200" />
                            <span>{item.title}</span>
                          </NavLink>
                        )}

                        {hasSubItems && isExpanded && item.subItems && (
                          <div className="ml-9 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {item.subItems.map((sub) => {
                              const isSubActive =
                                location.pathname + location.search === sub.path ||
                                (sub.path === "/operations?tab=tasks" &&
                                  location.pathname === "/operations" &&
                                  !location.search);

                              return (
                                <NavLink
                                  key={sub.path}
                                  to={sub.path}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
                                    isSubActive
                                      ? "text-foreground"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5"
                                  )}
                                >
                                  <sub.icon className="h-3.5 w-3.5 transition-transform duration-200" />
                                  <span>{sub.title}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Admin — solo administradores */}
                {isAdmin && workspace.showAdmin && (
                  <div className="mt-2 border-t border-border/40 pt-3">
                    <button
                      onClick={() => setAdminOpen(!adminOpen)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                        adminSubItems.some(s => location.pathname === s.path)
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Settings className="h-4 w-4 shrink-0 transition-transform duration-200" />
                      <span className="flex-1 text-left">Admin</span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        adminOpen && "rotate-180"
                      )} />
                    </button>
                    {adminOpen && (
                      <div className="ml-9 space-y-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        {adminSubItems.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
                              location.pathname === sub.path
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5"
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5 transition-transform duration-200" />
                            <span>{sub.title}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Static top bar spanning full width */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-2 md:gap-4 bg-header backdrop-blur-xl px-3 md:px-6 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] border-b border-border/30 dark:border-border/20"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          height: 'calc(3.5rem + env(safe-area-inset-top))'
        }}
      >
        {/* Hamburger button - solo mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="h-9 w-9 shrink-0"
            title="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Logo y texto - más pequeño en mobile */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-baseline gap-2 shrink-0"
        >
          <img
            src={logoSrc}
            alt="BUKZ"
            className="h-7 md:h-8 shrink-0 object-contain dark:invert transition-all duration-500 ease-out hover:scale-[1.02] hover:-translate-y-0.5 hover:brightness-[1.03] active:scale-100"
          />
          <span className="text-xl font-bold tracking-tight text-foreground hidden md:inline -mb-1">
            <span className="text-primary italic drop-shadow-[0_0.8px_0.8px_rgba(0,0,0,0.8)] dark:drop-shadow-none">Brain</span>
          </span>
        </button>

        <div className="flex-1" />

        {/* GlobalSearch - centrado en desktop, oculto en mobile */}
        <div id="header-search" className="hidden md:flex md:justify-center md:flex-1 md:max-w-md">
          <GlobalSearch />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 md:gap-3">
          {/* ThemeToggle - solo si mobile o sidebar collapsed */}
          {(isMobile || collapsed) && <ThemeToggle />}

          {/* Avatar */}
          <div id="header-user" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold transition-all duration-300 ease-out hover:shadow-md hover:scale-105">
              {userInitials}
            </div>
            {/* Nombre usuario - solo desktop */}
            <span className="text-sm font-medium text-foreground hidden md:inline">
              {userDisplayName}
            </span>
          </div>

          {/* Help tour button */}
          <Button
            id="btn-help-tour"
            variant="ghost"
            size="icon"
            onClick={() => setTourDialogOpen(true)}
            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
            title="Ayuda - Tour guiado"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>


      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 bg-sidebar",
          isMobile ? "ml-0" : (collapsed ? "ml-16" : "ml-60")
        )}
        style={{
          marginTop: 'calc(3.5rem + env(safe-area-inset-top))',
          marginBottom: 'calc(3.5rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="h-full bg-background rounded-none p-4 md:p-6 animate-fade-in shadow-sm">
          {children}
        </div>
      </main>


      {/* Tour confirmation dialog */}
      <AlertDialog open={tourDialogOpen} onOpenChange={setTourDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recorrido por BukzBrain</AlertDialogTitle>
            <AlertDialogDescription>
              Te guiaremos paso a paso por los módulos de la aplicación para que conozcas todas las herramientas disponibles. El recorrido dura menos de un minuto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setTourDialogOpen(false);
                setTimeout(() => startTour(), 150);
              }}
            >
              Iniciar recorrido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChatBubble />
    </div>
  );
}
