const CACHE_NAME = 'opencode-admin-v1';
const APP_SHELL = [
  '/manage/',
  '/manage/manifest.webmanifest',
  '/manage/assets/favicon-16x16.png',
  '/manage/assets/favicon-32x32.png',
  '/manage/assets/apple-touch-icon.png',
  '/manage/assets/icon-192.png',
  '/manage/assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || caches.match('/manage/'))
  );
});
