const CACHE = "carpool-together-v2";
const STATIC_ASSETS = ["/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    (!url.pathname.startsWith("/_next/static/") &&
      !STATIC_ASSETS.includes(url.pathname))
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Carpool Together",
    body: "Your carpool schedule has an update.",
    url: "/",
    tag: "carpool-update",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (error) {
    console.error("Could not read push notification", error);
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          await existing.navigate(target);
          return existing.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
