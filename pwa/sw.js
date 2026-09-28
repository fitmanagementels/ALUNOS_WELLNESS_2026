var CACHE_NAME = 'xsteam-static-v17';
var STATIC_ASSETS = ['./', './css/dashboard.css', './css/student-profiles.css', './css/permanencia.css', './vendor/chart.umd.js', './js/api.js', './js/sync-queue.js', './js/local-backup.js', './js/student-profiles.js', './js/permanencia.js', './js/app.js', './js/dashboard.js', './assets/xsteam-gestao-icon.svg', './manifest.webmanifest'];
STATIC_ASSETS.push('./js/import-ui.js', './js/import-model.mjs', './js/import-reader.mjs');
self.addEventListener('install', function (event) { event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(STATIC_ASSETS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request).then(function (response) {
    var copy = response.clone();
    caches.open(CACHE_NAME).then(function (cache) { return cache.put(event.request, copy); });
    return response;
  }).catch(function () { return caches.match(event.request); }));
});
