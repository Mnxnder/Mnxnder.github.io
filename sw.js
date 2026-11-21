/* MedTech Mastery offline cache. Version is the app's own hash, so a new
   build invalidates everything and the old cache is deleted on activate. */
const V = 'mtm-1740e07af9';
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

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const mine = u.origin === self.location.origin;
  const font = /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!mine && !font) return;
  if (u.pathname.endsWith('.zip')) return;   /* 2 MB download, no reason to keep it */
  e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
    if (hit) return hit;
    return fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    }).catch(() => hit || Response.error());
  })));
});
