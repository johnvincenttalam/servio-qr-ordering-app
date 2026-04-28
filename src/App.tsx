import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import HomePage from "@/pages/Home";
import MenuPage from "@/pages/Menu";
import CartPage from "@/pages/Cart";
import CheckoutPage from "@/pages/Checkout";
import OrderStatusPage from "@/pages/OrderStatus";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-status" element={<OrderStatusPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
