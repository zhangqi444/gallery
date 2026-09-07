/* Offline shell: the app files are content-hashed, so cache on first fetch and
 * serve from cache afterwards. Everything under content/ is not — bundle.json
 * and the practice topics keep their names from one build to the next — so they
 * are fetched network-first and only fall back to the cached copy when the
 * network is gone. Cache-first there would pin a visitor to whatever content
 * they saw on their first visit, for ever. */
var CACHE = 'littleme-v2';
var PRECACHE = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var networkFirst = req.mode === 'navigate' || /\/content\/.*\.json$|index\.html$/.test(req.url);
  if (networkFirst) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    });
  }));
});
