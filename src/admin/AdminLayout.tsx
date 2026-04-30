import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Utensils } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function AdminLayout() {
  const { user, role, signOut } = useAuth();
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
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-foreground text-background">
              <Utensils className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold tracking-tight">
              SERVIO Admin
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <AdminNavLink to="/admin">Dashboard</AdminNavLink>
            <AdminNavLink to="/kitchen">Kitchen</AdminNavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold leading-none">
                {user?.email}
              </p>
              {role && (
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function AdminNavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
          isActive
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:text-foreground hover:bg-muted"
        )
      }
    >
      {children}
    </NavLink>
  );
}
