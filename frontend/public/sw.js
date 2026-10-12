/* Iron Log service worker: app shell offline, network-first for pages, never caches the API. */
const VERSION = "ironlog-v1.0.0";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return; // always live
  // Navigations: network first, fall back to cached shell (works offline at the gym)
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put("/", copy));
      return res;
    }).catch(() => caches.match("/")));
    return;
  }
  // Static assets, fonts and exercise images: cache first, then network
  const cacheable = url.origin === location.origin || /cdn\.jsdelivr\.net|raw\.githubusercontent\.com/.test(url.host);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
