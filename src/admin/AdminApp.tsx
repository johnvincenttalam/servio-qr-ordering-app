import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/auth/AuthGuard";
import { AdminLayout } from "./AdminLayout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
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
        <Route
          path="orders"
          element={
            <ComingSoon
              title="Orders"
              description="A complete order history with filters, search, and per-order details. Coming next after the menu manager."
            />
          }
        />
        <Route
          path="menu"
          element={
            <ComingSoon
              title="Menu manager"
              description="Add and edit menu items, manage options, mark dishes 86'd without touching SQL. Up next."
            />
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
