import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/Home";
import MenuPage from "@/pages/Menu";
import CartPage from "@/pages/Cart";
import CheckoutPage from "@/pages/Checkout";
import OrderStatusPage from "@/pages/OrderStatus";

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
        <Toaster position="top-center" />
        <Routes>
          {/* Customer (table-based, no auth) */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-status" element={<OrderStatusPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
