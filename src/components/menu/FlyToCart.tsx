import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface FlyingItem {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
}

interface FlyToCartContextValue {
  flyToCart: (source: HTMLElement, imageUrl: string) => void;
}

const FlyToCartContext = createContext<FlyToCartContextValue>({
  flyToCart: () => {},
});

const ANIMATION_MS = 720;

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlyingItem[]>([]);

  const flyToCart = useCallback(
    (source: HTMLElement, imageUrl: string) => {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const target = document.querySelector<HTMLElement>(
        '[data-fly-target="cart"]'
      );
      if (!target) return;

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const sourceCenterX = sourceRect.left + sourceRect.width / 2;
      const sourceCenterY = sourceRect.top + sourceRect.height / 2;
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((curr) => [
        ...curr,
        {
          id,
          imageUrl,
          startX: sourceRect.left,
          startY: sourceRect.top,
          width: sourceRect.width,
          height: sourceRect.height,
          dx,
          dy,
        },
      ]);

      window.setTimeout(() => {
        setItems((curr) => curr.filter((f) => f.id !== id));
      }, ANIMATION_MS + 50);
    },
    []
  );

  return (
    <FlyToCartContext.Provider value={{ flyToCart }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[60]">
            {items.map((item) => (
              <FlyingImage key={item.id} item={item} />
            ))}
          </div>,
          document.body
        )}
    </FlyToCartContext.Provider>
  );
}

function FlyingImage({ item }: { item: FlyingItem }) {
  return (
    <img
      src={item.imageUrl}
      alt=""
      aria-hidden
      className="absolute rounded-2xl border border-border bg-card object-cover animate-fly-to-cart"
      style={
        {
          left: item.startX,
          top: item.startY,
          width: item.width,
          height: item.height,
          "--dx": `${item.dx}px`,
          "--dy": `${item.dy}px`,
        } as React.CSSProperties
      }
    />
  );
}

export function useFlyToCart() {
  return useContext(FlyToCartContext);
}
