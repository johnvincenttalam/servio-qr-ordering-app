import { Link } from "react-router-dom";
import {
  ChefHat,
  ListOrdered,
  UtensilsCrossed,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

export default function DashboardPage() {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Welcome back
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {user?.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-semibold text-foreground">{role}</span>.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          to="/kitchen"
          icon={ChefHat}
          title="Kitchen display"
          subtitle="Live order tickets, advance status with one tap"
          ready
        />
        <ActionCard
          icon={ListOrdered}
          title="Orders"
          subtitle="Coming soon — full order history"
        />
        <ActionCard
          icon={UtensilsCrossed}
          title="Menu manager"
          subtitle="Coming soon — add, edit, mark items 86'd"
        />
        <ActionCard
          icon={ImageIcon}
          title="Banners"
          subtitle="Coming soon — manage promo banners"
        />
      </section>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  subtitle,
  ready = false,
}: {
  to?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  ready?: boolean;
}) {
  const inner = (
    <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4 transition-all">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {ready && (
        <ChevronRight
          className="mt-1 h-4 w-4 text-muted-foreground"
          strokeWidth={2.2}
        />
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="opacity-70">{inner}</div>;
}
