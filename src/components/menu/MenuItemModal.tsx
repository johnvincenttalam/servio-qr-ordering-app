import { useState, useMemo, useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils";
import { useFlyToCart } from "./FlyToCart";
import type { MenuItem, CartItemSelection } from "@/types";

interface MenuItemModalProps {
  item: MenuItem | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    selections: CartItemSelection[]
  ) => void;
}

export function MenuItemModal({
  item,
  open,
  onClose,
  onAddToCart,
}: MenuItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string>
  >({});
  const imgRef = useRef<HTMLImageElement>(null);
  const { flyToCart } = useFlyToCart();

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedChoices({});
    }
  }, [item]);

  const selections = useMemo<CartItemSelection[]>(() => {
    if (!item?.options) return [];
    return item.options.flatMap((option) => {
      const choiceId = selectedChoices[option.id];
      if (!choiceId) return [];
      const choice = option.choices.find((c) => c.id === choiceId);
      if (!choice) return [];
      return [
        {
          optionId: option.id,
          optionName: option.name,
          choiceId: choice.id,
          choiceName: choice.name,
          priceDelta: choice.priceDelta ?? 0,
        },
      ];
    });
  }, [item, selectedChoices]);

  const requiredOptionsMissing = useMemo(() => {
    if (!item?.options) return false;
    return item.options.some(
      (option) => option.required && !selectedChoices[option.id]
    );
  }, [item, selectedChoices]);

  if (!item) return null;

  const outOfStock = item.inStock === false;
  const unitPrice =
    item.price + selections.reduce((sum, s) => sum + s.priceDelta, 0);
  const totalPrice = unitPrice * quantity;
  const canAdd = !outOfStock && !requiredOptionsMissing;

  const handleAdd = () => {
    if (!canAdd) return;
    if (imgRef.current) {
      flyToCart(imgRef.current, item.image);
    }
    onAddToCart(item, quantity, selections);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] max-w-sm gap-0 overflow-hidden rounded-3xl p-0">
        <div className="flex max-h-[92dvh] flex-col">
          <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
            <img
              ref={imgRef}
              src={item.image}
              alt={item.name}
              className={cn(
                "h-full w-full object-cover",
                outOfStock && "grayscale opacity-70"
              )}
            />
            <span className="absolute bottom-3 left-3 rounded-full border border-border bg-card px-3 py-1 text-sm font-bold text-foreground">
              {formatPrice(item.price)}
            </span>
            {outOfStock && (
              <span className="absolute bottom-3 right-3 rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
                Sold out
              </span>
            )}
          </div>

          <div className="overflow-y-auto p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-bold leading-tight">
                {item.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {item.description}
              </DialogDescription>
            </DialogHeader>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>

            {item.options && item.options.length > 0 && (
              <div className="mt-5 space-y-4">
                {item.options.map((option) => (
                  <div key={option.id}>
                    <div className="flex items-baseline justify-between">
                      <h4 className="text-sm font-semibold">{option.name}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {option.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {option.choices.map((choice) => {
                        const isSelected =
                          selectedChoices[option.id] === choice.id;
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() =>
                              setSelectedChoices((prev) =>
                                prev[option.id] === choice.id && !option.required
                                  ? Object.fromEntries(
                                      Object.entries(prev).filter(
                                        ([k]) => k !== option.id
                                      )
                                    )
                                  : { ...prev, [option.id]: choice.id }
                              )
                            }
                            aria-pressed={isSelected}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all active:scale-[0.98]",
                              isSelected
                                ? "border-foreground bg-foreground/5 text-foreground"
                                : "border-border bg-card text-foreground/70 hover:border-foreground/30 hover:text-foreground"
                            )}
                          >
                            <span className="font-medium">{choice.name}</span>
                            {choice.priceDelta ? (
                              <span className="text-xs font-semibold text-muted-foreground">
                                +{formatPrice(choice.priceDelta)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border p-4">
            {outOfStock ? (
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-muted px-5 py-3 font-semibold text-muted-foreground"
              >
                Sold out
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground transition-all hover:bg-muted active:scale-90 disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-7 text-center text-base font-bold">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-110 active:scale-90"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className="flex flex-1 items-center justify-center rounded-full bg-foreground px-5 py-3 font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                >
                  {requiredOptionsMissing
                    ? "Choose options"
                    : `Add · ${formatPrice(totalPrice)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
