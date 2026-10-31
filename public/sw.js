const CACHE = 'dy-board-shell-v1.0.0';
const SHELL = ['./', './manifest.webmanifest', './board-mark.svg'];
async function cacheAppShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const page = await cache.match('./');
  if (!page) return;
  const markup = await page.text();
  const assets = [...markup.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
    .map((match) => new URL(match[1], self.registration.scope))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  if (assets.length) await cache.addAll(assets);
}
self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('dy-board-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'DY_BOARD_SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? caches.match('./') : Response.error())));
});
