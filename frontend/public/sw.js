const CACHE = 'booth-verification-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.pathname.startsWith('/api/')) return; // never cache API
  if (u.pathname.endsWith('.apk')) return; // never cache the APK

  // Navigation: network-first, fall back to cached app shell (offline UI).
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cross-origin fonts (Google Fonts): cache-first with runtime caching.
  if (u.origin !== location.origin && (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
        return res;
      }).catch(() => undefined))
    );
    return;
  }

  // Same-origin static assets: cache-first, then network, then cache.
  if (u.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
          }
          return res;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
