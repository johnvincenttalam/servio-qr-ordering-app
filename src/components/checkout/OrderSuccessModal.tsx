import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface OrderSuccessModalProps {
  open: boolean;
  orderId: string | null;
  onView: () => void;
}

export function OrderSuccessModal({
  open,
  orderId,
  onView,
}: OrderSuccessModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onView();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-sm rounded-3xl p-8"
      >
        <div className="flex flex-col items-center text-center">
          <div className="animate-check-pulse">
            <svg
              className="h-20 w-20 text-foreground"
              viewBox="0 0 52 52"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="26"
                cy="26"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                className="animate-check-circle"
              />
              <path
                d="M14 27 L22 35 L38 19"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check-mark"
              />
            </svg>
          </div>

          <h2
            className="mt-6 text-2xl font-bold animate-fade-up"
            style={{ animationDelay: "750ms" }}
          >
            Order Placed
          </h2>
          <p
            className="mt-2 text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: "880ms" }}
          >
            {orderId ? (
              <>
                Order{" "}
                <span className="font-semibold text-foreground">#{orderId}</span>{" "}
                is on its way to the kitchen.
              </>
            ) : (
              "Your order is on its way to the kitchen."
            )}
          </p>

          <button
            onClick={onView}
            className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-3.5 font-semibold text-background transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98] animate-fade-up"
            style={{ animationDelay: "1020ms" }}
          >
            Track Order
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
