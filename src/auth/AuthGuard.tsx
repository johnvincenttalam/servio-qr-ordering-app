import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, type StaffRole } from "./AuthProvider";

interface AuthGuardProps {
  children: React.ReactNode;
  /**
   * If provided, the user's role must be in this list.
   * Omit to allow any signed-in staff regardless of role.
   */
  allowedRoles?: StaffRole[];
}

const SPINNER_DELAY_MS = 250;

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(
      () => setShowSpinner(true),
      SPINNER_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    if (!showSpinner) return null;
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2
          className="h-6 w-6 animate-spin text-muted-foreground"
          strokeWidth={2}
        />
      </div>
    );
  }

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

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-bold">Not allowed</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Your role (<span className="font-semibold">{role}</span>) doesn&apos;t
          have access to this area. Contact an admin if this is wrong.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
