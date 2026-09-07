/* Service Worker — Detetive Global (PWA)
   Estratégias:
   - navegação (HTML): network-first, cai para index.html em cache (offline)
   - shell (css/js/dados): stale-while-revalidate
   - /assets/** (bandeiras, formas, áudios, ícones): cache-first
   - CDNs (fontes, confetti, peerjs): stale-while-revalidate
*/
const VERSION = 'v4-2026-09-08';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/css/app-shell.css',
  '/css/screens.css',
  '/script.js',
  '/countries.js',
  '/collections.js',
  '/figurinhas_data.js',
  '/curiosities.js',
  '/curiosities_br.js',
  '/js/sfx.js',
  '/js/config.js',
  '/js/vendor/supabase.min.js',
  '/js/data-online.js',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isAsset(url) {
  return url.pathname.startsWith('/assets/');
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);
  return cached || network || fetch(request);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp && (resp.ok || resp.type === 'opaque')) cache.put(request, resp.clone());
    return resp;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirstDoc(request) {
  try {
    const resp = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put('/index.html', resp.clone());
    return resp;
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não intercepta a API (Supabase etc.) nem WebSockets
  if (url.pathname.startsWith('/api/') || url.protocol === 'ws:' || url.protocol === 'wss:') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDoc(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (isAsset(url)) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    } else {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    }
    return;
  }

  // CDNs externos (Google Fonts, jsdelivr, unpkg)
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});
