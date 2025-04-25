const CACHE_NAME = 'alvarez-clock-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/images/alvarez-logo.png',
    '/sounds/bell.mp3',
    '/socket.io/socket.io.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
}); 