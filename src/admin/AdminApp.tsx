import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/auth/AuthGuard";
import { AdminLayout } from "./AdminLayout";
import LoginPage from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import DashboardPage from "./pages/Dashboard";
import MenuManagerPage from "./pages/MenuManager";
import OrdersPage from "./pages/Orders";
import BannersPage from "./pages/Banners";
import StaffPage from "./pages/Staff";
import TablesPage from "./pages/Tables";
import CategoriesPage from "./pages/Categories";
import ActivityPage from "./pages/Activity";
import SettingsPage from "./pages/Settings";
import ProfilePage from "./pages/Profile";

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
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
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="menu"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <MenuManagerPage />
            </AuthGuard>
          }
        />
        <Route
          path="categories"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <CategoriesPage />
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
        <Route
          path="activity"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <ActivityPage />
            </AuthGuard>
          }
        />
        <Route
          path="settings"
          element={
            <AuthGuard allowedRoles={["admin"]}>
              <SettingsPage />
            </AuthGuard>
          }
        />
      </Route>
    </Routes>
  );
}
