import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { StoreBoot } from "@/components/StoreBoot";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Sales from "./pages/Sales";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Queue from "./pages/Queue";
import Services from "./pages/Services";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <StoreBoot>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute allow={["atendimento", "gerencia"]}>
                    <Sales />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allow={["gerencia"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute allow={["atendimento", "gerencia"]}>
                    <Customers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/historico"
                element={
                  <ProtectedRoute allow={["atendimento", "gerencia"]}>
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute allow={["gerencia"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fila"
                element={
                  <ProtectedRoute allow={["lavajato", "gerencia", "atendimento"]}>
                    <Queue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/servicos"
                element={
                  <ProtectedRoute allow={["gerencia"]}>
                    <Services />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StoreBoot>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
