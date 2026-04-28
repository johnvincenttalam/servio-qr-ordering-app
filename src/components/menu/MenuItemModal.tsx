import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/common/QuantitySelector";
import { formatPrice } from "@/utils";
import type { MenuItem } from "@/types";

interface MenuItemModalProps {
  item: MenuItem | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number) => void;
}

export function MenuItemModal({
  item,
  open,
  onClose,
  onAddToCart,
}: MenuItemModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!item) return null;

  const handleAdd = () => {
    onAddToCart(item, quantity);
    setQuantity(1);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setQuantity(1);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="aspect-video overflow-hidden">
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="p-4">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg">{item.name}</DialogTitle>
            <DialogDescription className="text-base text-primary font-bold">
              {formatPrice(item.price)}
            </DialogDescription>
          </DialogHeader>
          <p className="mt-3 text-sm text-muted-foreground">
            {item.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <QuantitySelector quantity={quantity} onChange={setQuantity} />
            <Button
              className="bg-emerald hover:bg-emerald/90"
              onClick={handleAdd}
            >
              Add {formatPrice(item.price * quantity)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
