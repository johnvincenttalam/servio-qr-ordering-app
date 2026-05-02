import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/auth/AuthProvider";
import { RestaurantSettingsProvider } from "@/hooks/useRestaurantSettings";
import { BusinessHoursProvider } from "@/hooks/useBusinessHours";
import { SettingsBoot } from "@/components/common/SettingsBoot";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/Home";
import MenuPage from "@/pages/Menu";
import CartPage from "@/pages/Cart";
import CheckoutPage from "@/pages/Checkout";
import OrderStatusPage from "@/pages/OrderStatus";
import HistoryPage from "@/pages/History";
import ClosedPage from "@/pages/Closed";
import { ClosedGuard } from "@/components/common/ClosedGuard";

const AdminApp = lazy(() => import("@/admin/AdminApp"));
const KitchenApp = lazy(() => import("@/kitchen/KitchenApp"));

const SPLASH_MIN_MS = 1800;
const SPLASH_FADE_MS = 380;

function useDismissSplash() {
  useEffect(() => {
    const splash = document.getElementById("app-splash");
    if (!splash) return;

    const elapsed = performance.now();
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);

    const fadeTimer = window.setTimeout(() => {
      splash.dataset.hide = "true";
      window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, remaining);

    return () => window.clearTimeout(fadeTimer);
  }, []);
}

export default function App() {
  useDismissSplash();

  return (
    <BrowserRouter>
      <AuthProvider>
        <RestaurantSettingsProvider>
          <BusinessHoursProvider>
          <SettingsBoot />
          <Toaster position="top-center" />
          <Routes>
            {/* /closed is a full-screen takeover — no customer chrome,
                no cart icon to tempt a click that won't work. Lives
                outside AppLayout so the sticky header doesn't render. */}
            <Route path="/closed" element={<ClosedPage />} />

            {/* Customer (table-based, no auth) */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/menu"
                element={
                  <ClosedGuard>
                    <MenuPage />
                  </ClosedGuard>
                }
              />
              <Route
                path="/cart"
                element={
                  <ClosedGuard>
                    <CartPage />
                  </ClosedGuard>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ClosedGuard>
                    <CheckoutPage />
                  </ClosedGuard>
                }
              />
              <Route
                path="/order-status"
                element={
                  <ClosedGuard>
                    <OrderStatusPage />
                  </ClosedGuard>
                }
              />
              <Route
                path="/history"
                element={
                  <ClosedGuard>
                    <HistoryPage />
                  </ClosedGuard>
                }
              />
            </Route>

            {/* Admin (lazy chunk) */}
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={null}>
                  <AdminApp />
                </Suspense>
              }
            />

            {/* Kitchen (lazy chunk, shares the same auth) */}
            <Route
              path="/kitchen/*"
              element={
                <Suspense fallback={null}>
                  <KitchenApp />
                </Suspense>
              }
            />
          </Routes>
          </BusinessHoursProvider>
        </RestaurantSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
