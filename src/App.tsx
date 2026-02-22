import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Tasks from "./pages/Tasks";
import Instructions from "./pages/Instructions";
import Requests from "./pages/Requests";
import Login from "./pages/Login";
import GuideDetail from "./pages/GuideDetail";
import BookstoreRequests from "./pages/BookstoreRequests";
import NavigationAdmin from "./pages/NavigationAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename="/BukzBrainv2">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="*"
                element={
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/operations" element={<Operations />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/instructions" element={<Instructions />} />
                      <Route path="/instructions/:slug" element={<GuideDetail />} />
                      <Route path="/requests" element={<Requests />} />
                      <Route path="/bookstore-requests" element={<BookstoreRequests />} />
                      <Route path="/nav-admin" element={<NavigationAdmin />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

