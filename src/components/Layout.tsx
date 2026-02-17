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
  FileText,
  Store,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: Home },
  {
    title: "Operaciones",
    path: "/operations",
    icon: ListChecks,
    subItems: [
      {
        title: "Tareas entre áreas",
        path: "/operations?tab=tasks",
        icon: ClipboardList,
      },
      {
        title: "Archivos",
        path: "/operations?tab=files",
        icon: FileText,
      },
    ],
  },
  { title: "Tareas", path: "/tasks", icon: ClipboardList },
  { title: "Guías", path: "/instructions", icon: BookOpen },
  { title: "Solicitudes", path: "/requests", icon: CalendarDays },
  { title: "Solicitud Librerías", path: "/bookstore-requests", icon: Store },
];

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

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
        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 pt-4">
          {navItems
            .filter((item) => {
              if (item.path === "/operations" && user?.email === "librerias@bukz.co") return false;
              return true;
            })
            .map((item) => {
              const isActive = location.pathname === item.path;
              const isOperations = item.path === "/operations";
              const showSubItems =
                isOperations &&
                location.pathname.startsWith("/operations") &&
                !collapsed;

              return (
                <div key={item.path} className="space-y-1">
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-theme",
                      isActive
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive && "text-foreground"
                      )}
                    />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>

                  {showSubItems && item.subItems && (
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
                              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-theme",
                              isSubActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <sub.icon className="h-3.5 w-3.5" />
                            <span>{sub.title}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        {/* Bottom */}
        <div className="p-2">
          <div className="flex items-center justify-between px-2">
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
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex flex-col h-full bg-sidebar">
              {/* Logo header dentro del drawer */}
              <div className="h-14 flex items-center px-4 border-b border-border/40">
                <img src={logoSrc} alt="BUKZ" className="h-7 object-contain dark:invert" />
                <span className="ml-3 text-lg font-bold tracking-tight">
                  Bukz<span className="text-primary italic">Brain</span>
                </span>
              </div>

              {/* Navegación - mismo contenido que sidebar */}
              <nav className="flex-1 space-y-1 p-2 pt-4 overflow-y-auto">
                {navItems
                  .filter((item) => {
                    if (item.path === "/operations" && user?.email === "librerias@bukz.co") return false;
                    return true;
                  })
                  .map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <div key={item.path} className="space-y-1">
                        <NavLink
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-theme",
                            isActive
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>

                        {/* Mostrar subitems siempre en mobile si está activo */}
                        {item.subItems && location.pathname.startsWith(item.path) && (
                          <div className="ml-9 space-y-1">
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
                                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-theme",
                                    isSubActive
                                      ? "text-foreground"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  <sub.icon className="h-3.5 w-3.5" />
                                  <span>{sub.title}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Static top bar spanning full width */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-2 md:gap-4 bg-header px-3 md:px-6">
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

        {/* Logo - más pequeño en mobile */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 shrink-0"
        >
          <img
            src={logoSrc}
            alt="BUKZ"
            className="h-7 md:h-8 shrink-0 object-contain dark:invert transition-all duration-500 ease-out hover:scale-[1.02] hover:-translate-y-0.5 hover:brightness-[1.03] active:scale-100"
          />
        </button>

        {/* Separador y título - solo desktop */}
        <div className="h-6 w-px bg-border/40 mx-2 hidden md:block" />
        <span className="text-xl font-bold tracking-tight text-foreground hidden md:block">
          Bukz<span className="text-primary italic drop-shadow-[0_0.8px_0.8px_rgba(0,0,0,0.8)] dark:drop-shadow-none">Brain</span>
        </span>

        <div className="flex-1" />

        {/* GlobalSearch - centrado en desktop, oculto en mobile */}
        <div className="hidden md:flex md:justify-center md:flex-1 md:max-w-md">
          <GlobalSearch />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 md:gap-3">
          {/* ThemeToggle - solo si mobile o sidebar collapsed */}
          {(isMobile || collapsed) && <ThemeToggle />}

          {/* Avatar */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
              {userInitials}
            </div>
            {/* Nombre usuario - solo desktop */}
            <span className="text-sm font-medium text-foreground hidden md:inline">
              {userDisplayName}
            </span>
          </div>

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
          "flex-1 mt-14 transition-all duration-300 bg-sidebar",
          isMobile ? "ml-0" : (collapsed ? "ml-16" : "ml-60")
        )}
      >
        <div className="h-full bg-background rounded-tl-2xl p-4 md:p-6 animate-fade-in shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
