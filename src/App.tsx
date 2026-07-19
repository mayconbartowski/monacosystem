import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/authContext";
import { DataProvider } from "@/lib/DataContext";
import { RequireRole } from "@/components/RequireRole";
import Sales from "./pages/Sales";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import History from "./pages/History";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Queue from "./pages/Queue";
import Services from "./pages/Services";
import Settings from "./pages/Settings";
import Partners from "./pages/Partners";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <RequireRole allow={["atendimento", "gerencia"]}><Sales /></RequireRole>
              } />
              <Route path="/fila" element={
                <RequireRole allow={["lavajato", "gerencia"]}><Queue /></RequireRole>
              } />
              <Route path="/clientes" element={
                <RequireRole allow={["atendimento", "gerencia"]}><Customers /></RequireRole>
              } />
              <Route path="/historico" element={
                <RequireRole allow={["atendimento", "gerencia"]}><History /></RequireRole>
              } />

              <Route path="/dashboard" element={
                <RequireRole allow={["gerencia"]}><Dashboard /></RequireRole>
              } />
              <Route path="/relatorios" element={
                <RequireRole allow={["gerencia"]}><Reports /></RequireRole>
              } />
              <Route path="/servicos" element={
                <RequireRole allow={["gerencia"]}><Services /></RequireRole>
              } />
              <Route path="/configuracoes" element={
                <RequireRole allow={["gerencia"]}><Settings /></RequireRole>
              } />
              <Route path="/parceiros" element={
                <RequireRole allow={["gerencia"]}><Partners /></RequireRole>
              } />

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
