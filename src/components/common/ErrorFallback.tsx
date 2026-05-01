import { AlertCircle, RotateCw } from "lucide-react";

/**
 * Last-resort UI shown by the Sentry ErrorBoundary when a render
 * crashes. Keeps copy human and gives a single recovery action so
 * customers don't see a blank screen.
 */
export function ErrorFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <AlertCircle
            className="h-7 w-7 text-foreground"
            strokeWidth={2}
          />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve been notified and we&apos;re looking at it. Try
            reloading — most of the time that gets you back in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <RotateCw className="h-4 w-4" strokeWidth={2.4} />
          Reload
        </button>
      </div>
    </div>
  );
}
