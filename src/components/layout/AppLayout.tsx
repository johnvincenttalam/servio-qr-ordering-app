import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "./Header";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";
import { FlyToCartProvider } from "@/components/menu/FlyToCart";

export function AppLayout() {
  return (
    <FlyToCartProvider>
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl">
          <main className="px-4 pb-36 pt-4">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-center" richColors />
        <ReloadPrompt />
      </div>
    </FlyToCartProvider>
  );
}
