import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem } from "@/types";

interface AppState {
  tableId: string | null;
  cart: CartItem[];
  currentOrderId: string | null;

  setTableId: (id: string) => void;
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCurrentOrderId: (id: string | null) => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tableId: null,
      cart: [],
      currentOrderId: null,

      setTableId: (id) => set({ tableId: id }),

      addToCart: (item, quantity = 1) =>
        set((state) => {
          const existing = state.cart.find((ci) => ci.id === item.id);
          if (existing) {
            return {
              cart: state.cart.map((ci) =>
                ci.id === item.id
                  ? { ...ci, quantity: ci.quantity + quantity }
                  : ci
              ),
            };
          }
          return { cart: [...state.cart, { ...item, quantity }] };
        }),

      removeFromCart: (id) =>
        set((state) => ({
          cart: state.cart.filter((ci) => ci.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { cart: state.cart.filter((ci) => ci.id !== id) };
          }
          return {
            cart: state.cart.map((ci) =>
              ci.id === id ? { ...ci, quantity } : ci
            ),
          };
        }),

      clearCart: () => set({ cart: [] }),

      setCurrentOrderId: (id) => set({ currentOrderId: id }),

      getCartTotal: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getCartItemCount: () =>
        get().cart.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: "servio-session",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
