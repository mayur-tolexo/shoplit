// Minimal service worker: required for PWA installability.
// Network passthrough — intentionally no caching so pages never go stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith → the browser handles the request normally.
});
