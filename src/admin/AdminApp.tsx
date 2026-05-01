import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/auth/AuthGuard";
import { AdminLayout } from "./AdminLayout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import MenuManagerPage from "./pages/MenuManager";
import OrdersPage from "./pages/Orders";
import BannersPage from "./pages/Banners";
import StaffPage from "./pages/Staff";
import TablesPage from "./pages/Tables";

export default function AdminApp() {
  return (
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
        <Route path="orders" element={<OrdersPage />} />
        <Route
          path="menu"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <MenuManagerPage />
            </AuthGuard>
          }
        />
        <Route
          path="banners"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <BannersPage />
            </AuthGuard>
          }
        />
        <Route
          path="staff"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <StaffPage />
            </AuthGuard>
          }
        />
        <Route
          path="tables"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <TablesPage />
            </AuthGuard>
          }
        />
      </Route>
    </Routes>
  );
}
