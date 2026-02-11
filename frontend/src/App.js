import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Findings } from "./pages/Findings";
import { RCAWizard } from "./pages/RCAWizard";
import { CAPA } from "./pages/CAPA";
import { RiskMatrix } from "./pages/RiskMatrix";
import { Evidence } from "./pages/Evidence";
import { Analytics } from "./pages/Analytics";
import { Users } from "./pages/Users";
import { Settings } from "./pages/Settings";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="findings" element={<Findings />} />
            <Route path="rca" element={<RCAWizard />} />
            <Route path="capa" element={<CAPA />} />
            <Route path="risk-matrix" element={<RiskMatrix />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
