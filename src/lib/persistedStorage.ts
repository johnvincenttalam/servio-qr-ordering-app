import type { StateStorage } from "zustand/middleware";

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface Envelope {
  expiresAt: number;
  raw: string;
}

/**
 * localStorage-backed storage for Zustand `persist` with a sliding TTL.
 * Each write resets the expiry; on read, expired entries are evicted and
 * treated as missing so the store rehydrates with its initial state.
 *
 * Falls back to a no-op when localStorage is unavailable (Safari private
 * mode, SSR, disabled storage) so the app still functions in-memory.
 */
export const persistedLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(name);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const env = JSON.parse(raw) as Envelope;
      if (
        typeof env?.expiresAt !== "number" ||
        typeof env?.raw !== "string"
      ) {
        return null;
      }
      if (Date.now() > env.expiresAt) {
        window.localStorage.removeItem(name);
        return null;
      }
      return env.raw;
    } catch {
      window.localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    const env: Envelope = { expiresAt: Date.now() + TTL_MS, raw: value };
    try {
      window.localStorage.setItem(name, JSON.stringify(env));
    } catch {
      // quota exceeded or storage disabled — drop silently; the store
      // continues to work in-memory.
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};
