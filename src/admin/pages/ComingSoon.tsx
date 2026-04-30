import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
      </header>

      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Sparkles className="h-6 w-6 text-foreground/70" strokeWidth={2} />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Coming soon</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Link
          to="/admin"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
