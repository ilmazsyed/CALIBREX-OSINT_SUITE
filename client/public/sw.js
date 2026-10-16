/* Calibrex service worker: installable PWA shell + Web Push.
   Strategy: network-first for navigations and index (always get fresh app after
   a deploy, fall back to cache offline); cache-first for hashed static assets;
   API requests are never cached. */
const CACHE = 'calibrex-v6';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // leave cross-origin (tiles, APIs) alone
  if (url.pathname.startsWith('/api/')) return;           // never cache API/data

  // Navigations & the HTML shell: network-first, cache fallback (offline).
  // If the server answers a navigation with a non-OK (e.g. a 404 "Not Found"
  // for a path the SPA doesn't serve), fall back to the cached app shell so the
  // single-page app still loads instead of showing the server's error page.
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(req).then((res) => {
        if (!res.ok && req.mode === 'navigate') {
          return caches.match('/').then((r) => r || caches.match('/index.html').then((x) => x || res));
        }
        caches.open(CACHE).then((c) => c.put('/', res.clone())).catch(() => {});
        return res;
      }).catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Static assets (hashed): cache-first, then network (and cache it).
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => cached))
  );
});

// ---------------------------------------------------------------- Web Push
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Calibrex alert';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
    vibrate: [70, 40, 70],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // This app has no URL-based routes — every view is in-app state — so a
  // notification should simply open/focus the app, never navigate to a stored
  // sub-path (a stale or misconfigured url would 404 with "Not Found").
  // We only honour a genuinely cross-origin http(s) link (rare); anything
  // same-origin or malformed opens the app root (the SW scope, always valid).
  const scope = self.registration.scope;              // absolute app root
  let target = scope;
  try {
    const raw = e.notification.data && e.notification.data.url;   // relative deep link (e.g. /?reader=…) or external link
    if (raw) {
      const u = new URL(raw, scope);                  // resolves relative links against the app origin
      if (u.protocol === 'https:' || u.protocol === 'http:') target = u.href;
    }
  } catch { target = scope; }

  let sameOrigin = true;
  try { sameOrigin = new URL(target).origin === self.location.origin; } catch { sameOrigin = true; }

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (sameOrigin) {
        for (const w of wins) {
          try {
            if (new URL(w.url).origin === self.location.origin) {
              // Hand the deep link to the already-open app (it routes without a
              // reload), then focus that window.
              w.postMessage({ type: 'cx:notification', url: target });
              return 'focus' in w ? w.focus() : undefined;
            }
          } catch { /* ignore */ }
        }
      }
      // No app window open (or a genuine external link) → open it fresh; the
      // app reads the ?reader / ?view params on load.
      return self.clients.openWindow(target);
    })
  );
});
