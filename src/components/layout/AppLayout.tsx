import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";
import { FlyToCartProvider } from "@/components/menu/FlyToCart";

export function AppLayout() {
  return (
    <FlyToCartProvider>
      <div className="min-h-dvh bg-background">
        {/* Skip link — visible only when keyboard-focused. Lets a screen-reader
            or tab-only user jump past the sticky header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background focus:outline focus:outline-2 focus:outline-foreground/40 focus:outline-offset-2"
        >
          Skip to main content
        </a>
        <Header />
        <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl">
          <main id="main" className="px-4 pb-36 pt-4">
            <Outlet />
          </main>
        </div>
        <ReloadPrompt />
      </div>
    </FlyToCartProvider>
  );
}
