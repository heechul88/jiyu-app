self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('v1').then((c) => c.addAll(['/'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
