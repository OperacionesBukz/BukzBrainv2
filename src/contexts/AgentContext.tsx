import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { ModuleContext } from "@/lib/agent/types";

const routeToModule: Record<string, ModuleContext> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tareas Personales",
  "/operations": "Operaciones",
  "/celesa": "Celesa",
  "/requests": "Solicitudes",
  "/bookstore-requests": "Solicitudes Librerias",
  "/requests-hub": "Hub de Solicitudes",
  "/reposicion": "Reposicion",
  "/ingreso": "Ingreso Mercancia",
  "/scrap": "Scrap Bukz",
  "/calculator": "Calculadora",
  "/instructions": "Instrucciones",
  "/nav-admin": "Admin Navegacion",
  "/user-admin": "Admin Usuarios",
  "/assistant": "Asistente",
};

interface AgentContextValue {
  currentModule: ModuleContext;
}

const AgentCtx = createContext<AgentContextValue>({ currentModule: "Desconocido" });

export function AgentProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const currentModule = useMemo<ModuleContext>(() => {
    return routeToModule[pathname] ?? "Desconocido";
  }, [pathname]);

  return (
    <AgentCtx.Provider value={{ currentModule }}>
      {children}
    </AgentCtx.Provider>
  );
}

export const useAgentContext = () => useContext(AgentCtx);
