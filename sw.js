// X 热点日报 service worker: network-first for pages & data (falls back to last copy offline),
// cache-first for icons.
const CACHE = 'xdaily-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })));
    return;
  }
  // network-first
  e.respondWith(
    fetch(req).then(res => {
      // store under the URL without ?t= so refreshes don't pile up copies
      if (res.ok) { const cp = res.clone(); const key = url.origin + url.pathname; caches.open(CACHE).then(c => c.put(key, cp)); }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req, {ignoreSearch: true}) || (req.mode === 'navigate' ? await caches.match('./index.html') : null);
      if (!hit) return new Response('offline', {status: 503});
      if (url.pathname.endsWith('.json')) {
        const body = await hit.text();
        return new Response(body, {headers: {'content-type': 'application/json', 'x-from-cache': '1'}});
      }
      return hit;
    })
  );
});
