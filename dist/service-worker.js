const CACHE_NAME = "abracadoo-human-key-pwa-v0-5";
const APP_SHELL = [
  "/",
  "/index.html",
  "/accept-witness/",
  "/accept-witness/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
];

async function cacheResponse(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url);
  const fallbackPath = url.pathname.startsWith("/accept-witness") ? "/accept-witness/index.html" : "/index.html";

  try {
    const response = await fetch(request);
    await cacheResponse(request, response.clone());
    await cacheResponse(fallbackPath, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match(fallbackPath);
    if (fallback) return fallback;
    const indexShell = await caches.match("/index.html");
    if (indexShell && fallbackPath === "/index.html") return indexShell;
    const acceptShell = await caches.match("/accept-witness/index.html");
    if (acceptShell && fallbackPath === "/accept-witness/index.html") return acceptShell;
    throw new Error("Abracadoo app shell is unavailable offline.");
  }
}

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await cacheResponse(request, response.clone());
    return response;
  } catch {
    throw new Error(`Abracadoo asset is unavailable offline: ${request.url}`);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(cacheFirstThenNetwork(event.request));
});
