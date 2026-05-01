import { CURRENCY_SYMBOL } from "@/constants";

/**
 * Mutable module-level currency. Defaults to the build-time constant
 * (so render before settings hydrate looks correct), and gets bumped
 * by SettingsBoot once the live restaurant_settings row arrives.
 *
 * The mutability is deliberate: formatPrice gets called from non-React
 * places (toast strings inside hooks, the audit summary trigger
 * couldn't reach a React context anyway) so a single shared symbol
 * is simpler than threading a context through every callsite.
 */
let _currencySymbol = CURRENCY_SYMBOL;

export function setCurrencySymbol(symbol: string): void {
  if (symbol && symbol.trim().length > 0) {
    _currencySymbol = symbol;
  }
}

export function formatPrice(amount: number): string {
  return `${_currencySymbol}${amount.toFixed(2)}`;
}

export function formatRelative(timestamp: number, now: number): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
