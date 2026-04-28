import { VALID_TABLE_IDS, CURRENCY_SYMBOL } from "@/constants";

export function isValidTableId(id: string): boolean {
  return (VALID_TABLE_IDS as readonly string[]).includes(id);
}

export function formatPrice(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}
