import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useOpenStatus } from "@/hooks/useBusinessHours";

/**
 * Route-level guard for customer-facing pages that mutate or are
 * pre-order. Redirects to /closed when the venue isn't currently open
 * — covers both the "user manually typed /menu" case and the "user
 * was on /menu when hours rolled past close" case (useOpenStatus
 * ticks every 30s, so a status flip while a page is mounted will
 * trigger the redirect automatically).
 *
 * Not applied to /order-status or /history: those surface
 * already-placed orders, which the customer should be able to see
 * regardless of whether the kitchen is currently accepting new ones.
 */
export function ClosedGuard({ children }: { children: ReactNode }) {
  const status = useOpenStatus();
  if (status.kind !== "open") {
    return <Navigate to="/closed" replace />;
  }
  return <>{children}</>;
}
