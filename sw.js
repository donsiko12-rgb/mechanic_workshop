const CACHE_NAME = 'eltoro-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/client_dashboard.html',
    '/admin_dashboard.html',
    '/css/style.css',
    '/js/auth.js',
    '/js/admin.js',
    '/js/client.js',
    '/js/data.js',
    '/js/firebase-config.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install event: cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event: serve from cache if possible, else network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response; // Return cached version
                }
                return fetch(event.request); // Fetch from network
            })
    );
});
