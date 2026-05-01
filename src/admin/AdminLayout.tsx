import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Menu, Utensils } from "lucide-react";
import { Sidebar } from "./components/Sidebar";

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close the drawer whenever the route changes — covers any path
  // that's reached without going through a sidebar link click (e.g. a
  // toast action that calls navigate()).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar with the hamburger trigger. The sidebar
            slides in as an overlay on small screens. */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-3 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95"
          >
            <Menu className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <Link to="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-foreground text-background">
              <Utensils className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold tracking-tight">
              SERVIO Admin
            </span>
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
