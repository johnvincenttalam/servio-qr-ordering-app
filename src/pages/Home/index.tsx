import { QrCode } from "lucide-react";
import { useTableValidation } from "@/hooks/useTableValidation";

export default function HomePage() {
  const { error } = useTableValidation();

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <QrCode className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">Invalid Table</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // While validating / redirecting
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-primary/10 p-4">
        <QrCode className="h-12 w-12 text-primary" />
      </div>
      <h1 className="text-xl font-bold">Welcome to SERVIO</h1>
      <p className="text-sm text-muted-foreground">
        Setting up your table...
      </p>
    </div>
  );
}
