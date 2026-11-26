/* SakuIGD service worker.
   Kalau isi index.html diperbarui: cukup unggah index.html baru, pengguna otomatis dapat versi terbaru saat online.
   Kalau ikon/manifest diganti: naikkan angka VERSION di bawah ini. */
const VERSION = 'sakuigd-v3';
// Hanya hapus cache milik aplikasi ini (aplikasi lain di domain github.io yang sama tidak terganggu).
const APP = VERSION.replace(/v\d+$/, '');
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
                './icon-maskable-512.png', './apple-touch-icon.png', './favicon-48.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k.startsWith(APP)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Safari refuses redirected responses for navigations; rebuild them as plain responses.
function clean(res) {
  if (!res || !res.redirected) return res;
  return res.blob().then(b => new Response(b, {status: res.status, statusText: res.statusText, headers: res.headers}));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    // Online: fresh page (with a 3 s limit). Offline or slow: the saved copy.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const saved = await cache.match('./');
      const net = fetch(req).then(clean).then(res => {
        if (res && res.ok) cache.put('./', res.clone());
        return res;
      });
      if (!saved) return net;
      const slow = new Promise(r => setTimeout(() => r(saved), 3000));
      try { return await Promise.race([net, slow]); } catch (err) { return saved; }
    })());
    return;
  }

  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
    return res;
  })));
});
