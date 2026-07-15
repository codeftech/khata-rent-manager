/* KHATA service worker — offline shell, network-first for freshness */
const CACHE = "khata-v1";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // writes + APIs: default network
  if (url.pathname.startsWith("/api")) return;
  // network-first: always fresh online, fall back to cache offline
  e.respondWith(
    fetch(e.request)
      .then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/index.html")))
  );
});
