import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthGuard } from "@/auth/AuthGuard";
import DisplayPage from "./pages/Display";

export default function KitchenApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          index
          element={
            <AuthGuard allowedRoles={["admin", "kitchen"]}>
              <DisplayPage />
            </AuthGuard>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
