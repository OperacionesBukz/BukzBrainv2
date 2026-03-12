import { lazy, Suspense } from "react";
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

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Operations = lazy(() => import("./pages/Operations"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Instructions = lazy(() => import("./pages/Instructions"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const Requests = lazy(() => import("./pages/Requests"));
const BookstoreRequests = lazy(() => import("./pages/BookstoreRequests"));
const Reposicion = lazy(() => import("./pages/Reposicion"));
const Celesa = lazy(() => import("./pages/Celesa"));
const RequestsHub = lazy(() => import("./pages/RequestsHub"));
const NavigationAdmin = lazy(() => import("./pages/NavigationAdmin"));
const UserAdmin = lazy(() => import("./pages/UserAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename="/BukzBrainv2">
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
                              <Route path="/celesa" element={<Celesa />} />
                              <Route path="/nav-admin" element={<NavigationAdmin />} />
                              <Route path="/user-admin" element={<UserAdmin />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
