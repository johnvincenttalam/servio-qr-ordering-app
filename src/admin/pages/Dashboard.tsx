import { ChefHat, ListOrdered, UtensilsCrossed, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../AuthProvider";

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
        <StatCard
          icon={ChefHat}
          title="Kitchen display"
          subtitle="Coming soon — live order tickets"
        />
        <StatCard
          icon={ListOrdered}
          title="Orders"
          subtitle="Coming soon — full order history"
        />
        <StatCard
          icon={UtensilsCrossed}
          title="Menu manager"
          subtitle="Coming soon — add, edit, mark items 86'd"
        />
        <StatCard
          icon={ImageIcon}
          title="Banners"
          subtitle="Coming soon — manage promo banners"
        />
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
