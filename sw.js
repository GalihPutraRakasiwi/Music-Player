const CACHE = "wavvy-v1";
const SHELL = ["./index.html", "./style.css", "./app.js", "./pwa.js", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  // Hanya cache request GET untuk shell app
  if (e.request.method !== "GET") return;
  // Jangan cache blob URL (file musik lokal)
  if (e.request.url.startsWith("blob:")) return;

  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached)));
});
