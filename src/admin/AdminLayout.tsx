import { useState } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { LogOut, Utensils } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Sidebar } from "./components/Sidebar";

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/admin/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar — sidebar is hidden below md */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-foreground text-background">
              <Utensils className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold tracking-tight">
              SERVIO Admin
            </span>
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
            title={user?.email}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
