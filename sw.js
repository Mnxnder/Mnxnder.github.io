/* MedTech Mastery offline cache. Version is the app's own hash, so a new
   build invalidates everything and the old cache is deleted on activate. */
const V = 'mtm-9eb77f3173';
const CORE = ['./', 'index.html', 'app.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  /* allSettled, not addAll: one unreachable file must not abort the whole
     install and leave the page with no offline copy at all. */
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Pages are fetched from the network first and fall back to the cache; assets
   are served from the cache first. Cache-first on the page itself would hand
   back the previous build on the first visit after a deploy and only update on
   a second reload, which is no way to ship a fix. Offline still works: the
   moment the network fails, the cached page is served. */
async function freshPage(r) {
  try {
    const res = await fetch(r);
    if (res && res.ok) { const c = await caches.open(V); c.put(r, res.clone()); }
    return res;
  } catch (err) {
    const c = await caches.open(V);
    return (await c.match(r, { ignoreSearch: true }))
        || (await c.match('app.html'))
        || (await c.match('./'))
        || Response.error();
  }
}

async function cachedAsset(r) {
  const c = await caches.open(V);
  const hit = await c.match(r);
  if (hit) return hit;
  try {
    const res = await fetch(r);
    if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const mine = u.origin === self.location.origin;
  const font = /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!mine && !font) return;
  if (u.pathname.endsWith('.zip')) return;   /* 2 MB download, no reason to keep it */
  const isPage = r.mode === 'navigate' || r.destination === 'document'
              || u.pathname.endsWith('.html') || u.pathname.endsWith('/');
  e.respondWith(isPage && mine ? freshPage(r) : cachedAsset(r));
});
