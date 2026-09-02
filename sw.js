const CACHE = "energy-reminder-v1";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon-192.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("fetch", event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));
self.addEventListener("push", event => {
  const data = event.data?.json() || { title: "梦幻消除战体力已满", body: "体力已恢复至 100 点，快去闯关吧！" };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "icon-192.svg", badge: "icon-192.svg" }));
});
