import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/auth/AuthGuard";
import DisplayPage from "./pages/Display";

export default function KitchenApp() {
  return (
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
  );
}
