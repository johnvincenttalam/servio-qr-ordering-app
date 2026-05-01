import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";
import { FlyToCartProvider } from "@/components/menu/FlyToCart";

export function AppLayout() {
  return (
    <FlyToCartProvider>
      <div className="min-h-dvh bg-background">
        <Header />
        <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl">
          <main className="px-4 pb-36 pt-4">
            <Outlet />
          </main>
        </div>
        <ReloadPrompt />
      </div>
    </FlyToCartProvider>
  );
}
