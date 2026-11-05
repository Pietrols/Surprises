// Cache a complete, versioned app. Inventory is stored separately by the page.
const scope = self.registration.scope;
const prefix = 'second-cut:' + scope + ':';
const cacheName = prefix + 'v2';
const assets = ['index.html', 'style.css', 'app.js', 'packet.js', 'worker.js',
  'engine.js', 'recipes.js', 'validate.js', 'inventory.js', 'domain.js', 'storage.js'];
const urls = new Set(assets.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...urls].map(url => new Request(url, {cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const asset = event.request.mode === 'navigate' && url.pathname === new URL(scope).pathname
    ? new URL('index.html', scope).href : url.href;
  if (urls.has(asset)) {
    event.respondWith(caches.open(cacheName).then(async cache =>
      (await cache.match(asset)) || fetch(event.request)));
  }
});
