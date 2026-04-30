import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, CartItemSelection } from "@/types";

interface AppState {
  tableId: string | null;
  cart: CartItem[];
  currentOrderId: string | null;

  setTableId: (id: string) => void;
  addToCart: (
    item: { id: string; name: string; price: number; image: string },
    selections: CartItemSelection[],
    quantity?: number
  ) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  setCurrentOrderId: (id: string | null) => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export function lineIdOf(
  itemId: string,
  selections: CartItemSelection[]
): string {
  if (selections.length === 0) return itemId;
  const key = selections
    .map((s) => `${s.optionId}:${s.choiceId}`)
    .sort()
    .join("|");
  return `${itemId}::${key}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tableId: null,
      cart: [],
      currentOrderId: null,

      setTableId: (id) => set({ tableId: id }),

      addToCart: (item, selections, quantity = 1) =>
        set((state) => {
          const lineId = lineIdOf(item.id, selections);
          const unitPrice =
            item.price + selections.reduce((sum, s) => sum + s.priceDelta, 0);

          const existing = state.cart.find((ci) => ci.lineId === lineId);
          if (existing) {
            return {
              cart: state.cart.map((ci) =>
                ci.lineId === lineId
                  ? { ...ci, quantity: ci.quantity + quantity }
                  : ci
              ),
            };
          }
          return {
            cart: [
              ...state.cart,
              {
                lineId,
                itemId: item.id,
                name: item.name,
                basePrice: item.price,
                unitPrice,
                quantity,
                image: item.image,
                selections,
              },
            ],
          };
        }),

      removeFromCart: (lineId) =>
        set((state) => ({
          cart: state.cart.filter((ci) => ci.lineId !== lineId),
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { cart: state.cart.filter((ci) => ci.lineId !== lineId) };
          }
          return {
            cart: state.cart.map((ci) =>
              ci.lineId === lineId ? { ...ci, quantity } : ci
            ),
          };
        }),

      clearCart: () => set({ cart: [] }),

      setCurrentOrderId: (id) => set({ currentOrderId: id }),

      getCartTotal: () =>
        get().cart.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        ),

      getCartItemCount: () =>
        get().cart.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: "servio-session-v2",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
