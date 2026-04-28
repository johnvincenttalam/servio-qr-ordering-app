import { useNavigate } from "react-router-dom";
import { Clock, ChefHat, CheckCircle2, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/useAppStore";
import { useOrderStatus } from "@/hooks/useOrderStatus";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_DESCRIPTIONS,
} from "@/constants";
import type { OrderStatus } from "@/types";

const STATUS_ICONS: Record<OrderStatus, typeof Clock> = {
  pending: Clock,
  preparing: ChefHat,
  ready: CheckCircle2,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "text-yellow-500 bg-yellow-50",
  preparing: "text-blue-500 bg-blue-50",
  ready: "text-emerald bg-emerald/10",
};

export default function OrderStatusPage() {
  const navigate = useNavigate();
  const tableId = useAppStore((s) => s.tableId);
  const currentOrderId = useAppStore((s) => s.currentOrderId);
  const { order, isLoading } = useOrderStatus(currentOrderId);

  if (!tableId) {
    navigate("/", { replace: true });
    return null;
  }

  if (!currentOrderId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">No Active Order</h2>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t placed any orders yet.
        </p>
        <Button onClick={() => navigate("/menu")}>Browse Menu</Button>
      </div>
    );
  }

  if (isLoading && !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[order.status];
  const statusColor = STATUS_COLORS[order.status];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Order Status</h2>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className={`rounded-full p-4 ${statusColor}`}>
            <StatusIcon className="h-10 w-10" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Order {order.id}</p>
            <h3 className="mt-1 text-xl font-bold">
              {ORDER_STATUS_LABELS[order.status]}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {ORDER_STATUS_DESCRIPTIONS[order.status]}
            </p>
          </div>

          {/* Status progress */}
          <div className="flex w-full items-center justify-center gap-2 pt-2">
            {(["pending", "preparing", "ready"] as OrderStatus[]).map(
              (step, i) => {
                const stepIndex = ["pending", "preparing", "ready"].indexOf(
                  step
                );
                const currentIndex = [
                  "pending",
                  "preparing",
                  "ready",
                ].indexOf(order.status);
                const isActive = stepIndex <= currentIndex;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        isActive ? "bg-emerald" : "bg-muted"
                      }`}
                    />
                    {i < 2 && (
                      <div
                        className={`h-0.5 w-8 ${
                          stepIndex < currentIndex ? "bg-emerald" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>
          <div className="flex w-full justify-between px-1 text-xs text-muted-foreground">
            <span>Pending</span>
            <span>Preparing</span>
            <span>Ready</span>
          </div>
        </CardContent>
      </Card>

      {order.status === "ready" && (
        <Button
          className="w-full bg-emerald py-6 text-base font-semibold hover:bg-emerald/90"
          onClick={() => navigate("/menu")}
        >
          Order Again
        </Button>
      )}
    </div>
  );
}
