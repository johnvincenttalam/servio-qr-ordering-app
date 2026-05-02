/**
 * Device id — a stable per-browser UUID that anchors anti-abuse controls.
 *
 * Generated on first customer load and persisted in localStorage. Travels
 * with every customer write (order submit, undo, waiter call) so the
 * server-side trigger in 0017_anti_abuse_phase1.sql can rate-limit by
 * device and reject orders from blocklisted devices.
 *
 * Honest caveat: clearing localStorage = a fresh device. This is
 * deterrence-grade identity, not bulletproof — see docs/ANTI_ABUSE.md
 * for the design trade-off. Promote to a fingerprint library only if
 * the simpler control turns out not to be enough.
 */

const KEY = "servio.deviceId";

/** RFC 4122 v4 generator. Falls back to Math.random when crypto isn't around. */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers / non-secure contexts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the persistent device id, creating one on first call. Always
 * returns a string — falls back to an in-memory id if localStorage is
 * unavailable (private mode, quota), so callers don't have to nullable-check.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return generateUuid();
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 0) return existing;
    const fresh = generateUuid();
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Quota / private mode — return a session-only id rather than throw.
    return generateUuid();
  }
}
