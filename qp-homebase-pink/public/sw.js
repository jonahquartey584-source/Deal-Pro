// Ruby Homebase service worker: the app opens instantly from the phone's own
// storage, then refreshes itself in the background. Your data (/api/) always
// goes to the home computer; videos stream normally (with Range requests).
const VERSION = "ruby-1.9.0";
const SHELL = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/app.js", "js/icons.js", "js/liquid.js", "js/assistant.js", "js/lock.js",
  "js/views/shared.js", "js/views/home.js", "js/views/planner.js", "js/views/todo.js", "js/views/house.js",
  "js/views/meals.js", "js/views/cycle.js", "js/views/money.js", "js/views/bible.js", "js/views/journal.js",
  "js/views/jay.js", "js/views/settings.js", "js/views/more.js",
  "fonts/archivo-latin.woff2", "fonts/great-vibes-latin.woff2",
  "brand/logo-full.webp", "brand/logo-mono.webp", "ruby-icon-180.png", "favicon-32.png",
  "media/pink-dark.jpg", "media/pink-light.jpg", "media/green-dark.jpg", "media/green-light.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.endsWith(".mp4") || req.headers.has("range")) return; // network as normal
  if (req.mode === "navigate") {
    // opening the app: newest version from the MacBook if it answers within 2 s, otherwise the copy on the phone
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const net = fetch(req, { cache: "no-cache" }).then((res) => { if (res.ok) cache.put("index.html", res.clone()); return res; });
      const timeout = new Promise((r) => setTimeout(r, 2000));
      const res = await Promise.race([net.catch(() => null), timeout]);
      return res || (await cache.match("index.html")) || (await net.catch(() => new Response("Offline", { status: 503 })));
    }));
    e.waitUntil(self.registration.update().catch(() => {}));
    return;
  }
  const key = req;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok && res.type === "basic") cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; } // instant, then update quietly
    return (await fresh) || new Response("Offline", { status: 503 });
  }));
});
