import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthGuard } from "@/auth/AuthGuard";
import { AdminLayout } from "./AdminLayout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <AuthGuard>
              <AdminLayout />
            </AuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
