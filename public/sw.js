/* Service Worker – Offline-Cache + Web Push. Produktname kommt aus /sw-config.js (src/config/app.ts) */
try {
  importScripts("/sw-config.js");
} catch (_) {}
const APP_NAME = self.__APP_NAME || "App";
const VERSION = "v2";
const PAGE_CACHE = `pages-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Statische Next-Assets: Cache-first (Dateinamen enthalten Hash)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Seiten: Network-first, bei fehlendem Netz letzte bekannte Version
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname + url.search, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          return (
            (await cache.match(url.pathname + url.search)) ||
            (await cache.match(url.pathname)) ||
            (await caches.match("/offline")) ||
            Response.error()
          );
        }),
    );
  }
});

// Abmelden → zwischengespeicherte Seiten löschen (keine fremden Daten auf geteilten Geräten)
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
});

self.addEventListener("push", (event) => {
  let data = { title: APP_NAME, body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
