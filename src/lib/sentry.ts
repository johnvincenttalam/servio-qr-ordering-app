import * as Sentry from "@sentry/react";

/**
 * Initialise Sentry only when a DSN is configured. Without VITE_SENTRY_DSN
 * this is a no-op so dev environments stay quiet and prod stays
 * unconfigured-but-functional until you opt in by setting the env var.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Conservative sample rates: capture every error, sample 10% of
    // performance traces, only record session replay on errors.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Strip noise that's not actionable: failed fetches from extensions,
    // ResizeObserver loop warnings, etc.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "NetworkError when attempting to fetch resource",
      "Failed to fetch",
    ],
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;

/** Manually report a caught error you still want to track. */
export function reportError(err: unknown, context?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
