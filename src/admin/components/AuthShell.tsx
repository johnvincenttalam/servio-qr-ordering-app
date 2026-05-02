import type { ReactNode } from "react";
import { BrandMark } from "@/components/common/BrandMark";

interface AuthShellProps {
  title: string;
  subtitle: string;
  /** Form, success card, or any below-the-brand content. */
  children: ReactNode;
}

/**
 * Shared chrome for the admin auth pages (Login / Forgot password /
 * Reset password). Centers a max-w-sm column on a soft brand-tinted
 * background glow with a halo behind the SERVIO icon — adds quiet
 * atmosphere without making the form fields colourful, so the actual
 * sign-in surface stays calm and professional.
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      {/* Background glow — large soft brand-blue blob anchored above the
          column. Creates a "lit from the top" feel similar to the
          customer Order Status hero card. Pure decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-info/10 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative">
            {/* Tighter halo right behind the icon — reinforces the
                brand colour at the page's focal point. */}
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl bg-info/35 blur-xl"
            />
            <BrandMark className="h-14 w-14 shadow-lg shadow-info/20" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
