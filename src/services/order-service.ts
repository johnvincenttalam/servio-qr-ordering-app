import type { CartItem, Order, OrderStatus } from "@/types";

const SIMULATED_DELAY = 800;
const orders = new Map<string, Order>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateOrderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export async function submitOrder(params: {
  tableId: string;
  items: CartItem[];
  total: number;
  customerName?: string;
  notes?: string;
}): Promise<Order> {
  await delay(SIMULATED_DELAY);

  const order: Order = {
    id: generateOrderId(),
    tableId: params.tableId,
    items: params.items,
    total: params.total,
    status: "pending",
    customerName: params.customerName,
    notes: params.notes,
    createdAt: Date.now(),
  };

  orders.set(order.id, order);
  return order;
}

const STATUS_PROGRESSION: OrderStatus[] = ["pending", "preparing", "ready"];

export async function fetchOrderStatus(
  orderId: string
): Promise<Order | undefined> {
  await delay(400);

  const order = orders.get(orderId);
  if (!order) return undefined;

  // Simulate status progression based on elapsed time
  const elapsed = Date.now() - order.createdAt;
  let statusIndex = 0;
  if (elapsed > 20000) {
    statusIndex = 2; // ready after 20s
  } else if (elapsed > 10000) {
    statusIndex = 1; // preparing after 10s
  }

  order.status = STATUS_PROGRESSION[statusIndex];
  return { ...order };
}
