const CACHE_NAME = 'opencode-v3';
const PRECACHE = ['/', '/manifest.json?v=3', '/icon-192.png?v=3', '/icon-512.png?v=3'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Don't cache opencode API/SSE/WebSocket requests
    if (url.pathname.startsWith('/server/') || url.pathname.startsWith('/session/')) {
        return;
    }

    // Network-first for everything else
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                if (resp.ok && e.request.method === 'GET') {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
