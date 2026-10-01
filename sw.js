// Service worker de "Para Ti" — paso 1: la página abre sin conexión.
const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_FILES = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// Hosts de librerías y fuentes que conviene tener en caché para abrir sin internet
const CACHEABLE_HOSTS = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la copia guardada y en segundo plano la actualiza (así abre al instante y sin internet)
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  const network = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return; // audio/video: lo maneja el navegador (paso 2)
  const url = new URL(req.url);

  // Archivos propios de la página
  if (url.origin === location.origin) {
    e.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }
  // Librerías y fuentes
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req, RUNTIME));
  }
  // Todo lo demás (Firestore, Cloudinary, etc.) pasa directo a la red
});
