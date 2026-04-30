import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Image as ImageIcon,
  ChefHat,
  LogOut,
  Utensils,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";

export function Sidebar() {
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

  const initial =
    user?.email?.[0]?.toUpperCase() ?? user?.id.slice(0, 1).toUpperCase() ?? "?";

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Link to="/admin" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">
            <Utensils className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-bold leading-none tracking-tight">
              SERVIO
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        <SidebarLink to="/admin" end icon={LayoutDashboard} label="Dashboard" />
        <SidebarLink
          to="/admin/orders"
          icon={ListOrdered}
          label="Orders"
          badge="Soon"
        />
        <SidebarLink to="/admin/menu" icon={UtensilsCrossed} label="Menu" />
        <SidebarLink
          to="/admin/banners"
          icon={ImageIcon}
          label="Banners"
          badge="Soon"
        />

        <div className="my-3 px-3">
          <div className="border-t border-border" />
        </div>

        <SidebarLink
          to="/kitchen"
          icon={ChefHat}
          label="Kitchen"
          external
        />
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight">
              {user?.email}
            </p>
            {role && (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {role}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  end,
  icon: Icon,
  label,
  badge,
  external,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  badge?: string;
  external?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
          isActive
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-aria-[current=page]:border-background/30 group-aria-[current=page]:bg-background/15 group-aria-[current=page]:text-background/80">
          {badge}
        </span>
      )}
      {external && (
        <ExternalLink
          className="h-3 w-3 shrink-0 opacity-50"
          strokeWidth={2.2}
        />
      )}
    </NavLink>
  );
}
