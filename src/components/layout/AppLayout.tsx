import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "./Header";
import { ReloadPrompt } from "@/components/common/ReloadPrompt";

export function AppLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md sm:max-w-lg lg:max-w-xl bg-background shadow-sm">
      <Header />
      <main className="px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <Toaster position="top-center" richColors />
      <ReloadPrompt />
    </div>
  );
}
