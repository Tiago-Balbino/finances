// Finances service worker: keeps the app shell available so the installed app opens fast.
// Financial data (/api) always comes from the network and is never cached.
const CACHE = 'finances-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  // Pages: network first, so a new deploy shows up right away; cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); return response; })
      .catch(() => caches.match('/')));
    return;
  }

  // Built assets have hashed names and never change: cache first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});
