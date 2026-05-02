import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { BrandMark } from "@/components/common/BrandMark";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { AdminOrderPulseProvider } from "./useAdminOrderPulse";

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { settings } = useRestaurantSettings();

  // Auto-close the drawer whenever the route changes — covers any path
  // that's reached without going through a sidebar link click (e.g. a
  // toast action that calls navigate()).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Global ⌘K / Ctrl+K opens the command palette. Page-level searches
  // listen for "/" instead so the two don't fight for the same key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isPaletteShortcut =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isPaletteShortcut) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AdminOrderPulseProvider>
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
          <Link to="/admin" className="flex flex-1 items-center gap-2">
            <BrandMark className="h-8 w-8" />
            <span className="truncate text-sm font-bold tracking-tight">
              {settings.name} Admin
            </span>
          </Link>
          {/* Mobile entry point for the palette — keyboard ⌘K isn't an
              option on touch, so expose a tappable search button. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95"
          >
            <Search className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
    </AdminOrderPulseProvider>
  );
}
