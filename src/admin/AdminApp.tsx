import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/auth/AuthGuard";
import { AdminLayout } from "./AdminLayout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import MenuManagerPage from "./pages/MenuManager";
import OrdersPage from "./pages/Orders";
import ComingSoon from "./pages/ComingSoon";

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
            <ComingSoon
              title="Banners"
              description="Manage the promo banners that show at the top of the customer menu. Drag to reorder, toggle active state, upload new images."
            />
          }
        />
      </Route>
    </Routes>
  );
}
