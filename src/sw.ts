/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Precache + runtime cache
// ─────────────────────────────────────────────────────────────────────────────
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Cache Unsplash menu images so the menu loads instantly on repeat visits.
registerRoute(
  ({ url }) => url.hostname === "images.unsplash.com",
  new CacheFirst({
    cacheName: "menu-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
      }),
    ],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Web Push: "Your order is ready"
// ─────────────────────────────────────────────────────────────────────────────
interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener("push", (event) => {
  const rawText = event.data?.text() ?? "";
  console.log("[sw] push received:", rawText);

  let payload: PushPayload = { title: "SERVIO" };
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { title: "SERVIO", body: rawText };
    }
  }

  const notify = self.registration
    .showNotification(payload.title || "SERVIO", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: payload.tag ?? "servio-order",
      data: { url: payload.url ?? "/order-status" },
      requireInteraction: false,
    })
    .then(() => {
      console.log("[sw] notification shown");
    })
    .catch((err) => {
      console.error("[sw] showNotification failed:", err);
    });

  event.waitUntil(notify);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data as { url?: string } | undefined)?.url ??
    "/order-status";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reuse any same-origin tab so the in-memory + sessionStorage
      // app state (active order, table id) is preserved.
      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== self.location.origin) continue;
        if ("focus" in client) {
          await (client as WindowClient).focus();
          if (clientUrl.pathname !== targetUrl && "navigate" in client) {
            try {
              await (client as WindowClient).navigate(targetUrl);
            } catch {
              // navigate() can reject across cross-origin redirects; swallow.
            }
          }
          return;
        }
      }

      // No existing tab — open a fresh one. Note: this client won't share
      // sessionStorage with the original ordering session, so OrderStatus
      // will fall back to its empty-state.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// Allow the app shell to instruct the SW to skipWaiting (used by autoUpdate).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
