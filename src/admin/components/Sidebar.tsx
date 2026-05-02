import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Tag,
  Image as ImageIcon,
  Users,
  QrCode,
  ChefHat,
  LogOut,
  Settings,
  Utensils,
  ExternalLink,
  X,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { useRestaurantSettings } from "@/hooks/useRestaurantSettings";
import { useAdminOrderPulse } from "../useAdminOrderPulse";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  external?: boolean;
  /**
   * Roles that may see this link. Omit to mean "everyone signed in".
   * Mirrors the AuthGuard config on the corresponding route so the
   * sidebar never advertises a destination the user can't reach.
   */
  allowedRoles?: StaffRole[];
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/orders", icon: ListOrdered, label: "Orders" },
  {
    to: "/admin/menu",
    icon: UtensilsCrossed,
    label: "Menu",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/categories",
    icon: Tag,
    label: "Categories",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/banners",
    icon: ImageIcon,
    label: "Banners",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/tables",
    icon: QrCode,
    label: "Tables",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/staff",
    icon: Users,
    label: "Staff",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/activity",
    icon: Activity,
    label: "Activity",
    allowedRoles: ["admin"],
  },
  {
    to: "/admin/settings",
    icon: Settings,
    label: "Settings",
    allowedRoles: ["admin"],
  },
];

const SECONDARY_NAV: NavItem[] = [
  {
    to: "/kitchen",
    icon: ChefHat,
    label: "Kitchen",
    external: true,
    allowedRoles: ["admin", "kitchen"],
  },
];

interface SidebarProps {
  /** Whether the mobile drawer is open. Ignored on md+ where the sidebar is always visible. */
  isOpen: boolean;
  /** Called when the drawer should close (link tapped, backdrop clicked, X tapped). */
  onClose: () => void;
}

function visibleFor(role: StaffRole | null, items: NavItem[]) {
  return items.filter((item) => {
    if (!item.allowedRoles) return true;
    return role !== null && item.allowedRoles.includes(role);
  });
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, role, displayName, avatarUrl, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const { pendingCount } = useAdminOrderPulse();
  const { settings } = useRestaurantSettings();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/admin/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  // Prefer the staff display_name; fall back to the email's local-part
  // so the avatar always has a real-looking label.
  const visibleName =
    displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "Staff";
  const initial = visibleName[0]?.toUpperCase() ?? "?";

  const primary = visibleFor(role, PRIMARY_NAV);
  const secondary = visibleFor(role, SECONDARY_NAV);

  return (
    <>
      {/* Mobile-only backdrop. Tapping it closes the drawer. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />

      <aside
        aria-label="Primary navigation"
        className={cn(
          // Mobile: fixed overlay drawer, slides in from the left.
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-card transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: sticky in normal flow, no slide animation.
          "md:sticky md:top-0 md:w-60 md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <Link
            to="/admin"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-foreground text-background">
              <Utensils className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-none tracking-tight">
                {settings.name}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 md:hidden"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {primary.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                onNavigate={onClose}
                badge={item.to === "/admin/orders" ? pendingCount : 0}
              />
            ))}
          </div>

          {secondary.length > 0 && (
            <>
              <div className="my-4 px-3">
                <div className="border-t border-border" />
              </div>
              <div className="space-y-1">
                {secondary.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-border p-4">
          <NavLink
            to="/admin/profile"
            onClick={onClose}
            aria-label="Open your profile"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors active:scale-[0.99]",
                isActive
                  ? "bg-muted"
                  : "hover:bg-muted"
              )
            }
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={visibleName}
                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight">
                {visibleName}
              </p>
              {role && (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {role}
                </p>
              )}
            </div>
          </NavLink>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  onNavigate,
  badge = 0,
}: {
  item: NavItem;
  onNavigate: () => void;
  /** Optional unread/pending count to surface on this link. Falsy = hidden. */
  badge?: number;
}) {
  const { to, end, icon: Icon, label, external } = item;
  const showBadge = badge > 0;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
          isActive
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span className="flex-1 truncate">{label}</span>
          {showBadge && (
            <span
              key={badge}
              aria-label={`${badge} pending`}
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums animate-pop-in",
                isActive
                  ? "bg-background text-foreground"
                  : "bg-warning text-foreground"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {external && (
            <ExternalLink
              className="h-3 w-3 shrink-0 opacity-50"
              strokeWidth={2.2}
            />
          )}
        </>
      )}
    </NavLink>
  );
}
