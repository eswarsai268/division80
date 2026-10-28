const CACHE = 'booth-verification-v6';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];
const OFFLINE_HTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#edf5f8;color:#0f172a;text-align:center;padding:24px}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#475569;margin:0}</style></head><body><div><h1>You are offline</h1><p>Reconnect to load the app. Previously saved data is available once you are back online.</p></div></body></html>';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    try {
      const res = await fetch('/index.html');
      const html = await res.text();
      const urls = new Set();
      const assetRegex = /(?:src|href)="([^"]+)"/g;
      let m;
      while ((m = assetRegex.exec(html)) !== null) {
        const url = m[1];
        if (url.startsWith('/') && !url.startsWith('//')) urls.add(url);
      }
      await Promise.all([...urls].map((url) => cache.add(url).catch(() => undefined)));
    } catch { /* ignore */ }
  })());
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
      }).catch(() => caches.match('/index.html').then((hit) => hit || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
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
        }).catch(() => caches.match('/index.html').then((h) => h || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
      })
    );
  }
});
