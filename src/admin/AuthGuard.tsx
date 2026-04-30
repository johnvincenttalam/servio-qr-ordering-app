import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2
          className="h-6 w-6 animate-spin text-muted-foreground"
          strokeWidth={2}
        />
      </div>
    );
  }

  // Authed but not in staff table — block + sign out is too aggressive,
  // so just bounce to login with a flash message via location state.
  if (!user || !role) {
    const reason = user && !role ? "no-staff-record" : undefined;
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname, reason }}
      />
    );
  }

  return <>{children}</>;
}
