import { Suspense, useEffect } from "react";
import { lazyWithReload } from "@/lib/lazy-with-reload";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";
import { AgentProvider } from "@/contexts/AgentContext";
import { AgentChatProvider } from "@/lib/agent/use-agent-chat";

const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Operations = lazyWithReload(() => import("./pages/Operations"));
const Tasks = lazyWithReload(() => import("./pages/Tasks"));
const Instructions = lazyWithReload(() => import("./pages/Instructions"));
const GuideDetail = lazyWithReload(() => import("./pages/GuideDetail"));
const Requests = lazyWithReload(() => import("./pages/Requests"));
const BookstoreRequests = lazyWithReload(() => import("./pages/BookstoreRequests"));
const Reposicion = lazyWithReload(() => import("./pages/Reposicion"));
const Reposiciones = lazyWithReload(() => import("./pages/reposiciones"));
const Pedidos = lazyWithReload(() => import("./pages/Pedidos"));
const Novedades = lazyWithReload(() => import("./pages/Novedades"));
const Celesa = lazyWithReload(() => import("./pages/Celesa"));
const CelesaActualizacion = lazyWithReload(() => import("./pages/CelesaActualizacion"));
const IngresoMercancia = lazyWithReload(() => import("./pages/IngresoMercancia"));
const ScrapBukz = lazyWithReload(() => import("./pages/ScrapBukz"));
const CrearProductos = lazyWithReload(() => import("./pages/CrearProductos"));
const ActualizarProductos = lazyWithReload(() => import("./pages/ActualizarProductos"));
const Cortes = lazyWithReload(() => import("./pages/Cortes"));
const EnvioCortes = lazyWithReload(() => import("./pages/EnvioCortes"));
const Devoluciones = lazyWithReload(() => import("./pages/Devoluciones"));
const GiftCards = lazyWithReload(() => import("./pages/GiftCards"));
const Directorio = lazyWithReload(() => import("./pages/Directorio"));
const CMV = lazyWithReload(() => import("./pages/CMV"));
const Rotacion = lazyWithReload(() => import("./pages/Rotacion"));
const RequestsHub = lazyWithReload(() => import("./pages/RequestsHub"));
const CalculatorPage = lazyWithReload(() => import("./pages/Calculator"));
const UserManagement = lazyWithReload(() => import("./pages/admin/UserManagement"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const Login = lazyWithReload(() => import("./pages/Login"));
const Assistant = lazyWithReload(() => import("./pages/Assistant"));

const queryClient = new QueryClient();

function useEscapeBlur() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

const App = () => {
  useEscapeBlur();
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename="/BukzBrainv2">
            <AgentProvider>
              <AgentChatProvider>
                <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="*"
                    element={
                      <Layout>
                        <ErrorBoundary>
                          <Suspense fallback={<PageSkeleton />}>
                            <Routes>
                              <Route path="/dashboard" element={<Dashboard />} />
                              <Route path="/operations" element={<Operations />} />
                              <Route path="/tasks" element={<Tasks />} />
                              <Route path="/instructions" element={<Instructions />} />
                              <Route path="/instructions/:slug" element={<GuideDetail />} />
                              <Route path="/requests" element={<Requests />} />
                              <Route path="/bookstore-requests" element={<BookstoreRequests />} />
                              <Route path="/requests-hub" element={<RequestsHub />} />
                              <Route path="/reposicion" element={<Reposicion />} />
                              <Route path="/reposiciones" element={<Reposiciones />} />
                              <Route path="/pedidos" element={<Pedidos />} />
                              <Route path="/novedades" element={<Novedades />} />
                              <Route path="/celesa" element={<Navigate to="/celesa-seguimiento" replace />} />
                              <Route path="/celesa-seguimiento" element={<Celesa />} />
                              <Route path="/celesa-actualizacion" element={<CelesaActualizacion />} />
                              <Route path="/ingreso" element={<IngresoMercancia />} />
                              <Route path="/scrap" element={<ScrapBukz />} />
                              <Route path="/crear-productos" element={<CrearProductos />} />
                              <Route path="/actualizar-productos" element={<ActualizarProductos />} />
                              <Route path="/cortes" element={<Cortes />} />
                              <Route path="/envio-cortes" element={<EnvioCortes />} />
                              <Route path="/devoluciones" element={<Devoluciones />} />
                              <Route path="/gift-cards" element={<GiftCards />} />
                              <Route path="/directorio" element={<Directorio />} />
                              <Route path="/cmv" element={<CMV />} />
                              <Route path="/rotacion" element={<Rotacion />} />
                              <Route path="/assistant" element={<Assistant />} />
                              <Route path="/calculator" element={<CalculatorPage />} />
                              <Route path="/user-admin" element={<UserManagement />} />
                              <Route path="/nav-admin" element={<Navigate to="/user-admin" replace />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </ErrorBoundary>
                      </Layout>
                    }
                  />
                </Routes>
              </Suspense>
                </ErrorBoundary>
              </AgentChatProvider>
            </AgentProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
