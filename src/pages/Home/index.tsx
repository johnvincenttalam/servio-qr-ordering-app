import { QrCode, AlertCircle, Utensils } from "lucide-react";
import { useTableValidation } from "@/hooks/useTableValidation";

export default function HomePage() {
  const { error } = useTableValidation();

  if (error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center animate-fade-up">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-muted">
          <AlertCircle className="h-12 w-12 text-foreground" strokeWidth={1.6} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold">Invalid Table</h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            {error}
          </p>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" />
          Scan the QR code on your table to continue
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground">
        <Utensils className="h-7 w-7 text-background" strokeWidth={2.2} />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">SERVIO</h1>
        <p className="text-sm text-muted-foreground">Setting up your table…</p>
      </div>
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:160ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:320ms]" />
      </div>
    </div>
  );
}
