const CACHE_NAME = 'Riverside-Connect-v6';   // ← change version when strategy changes significantly

const STATIC_ASSETS = [
  './',
  './login.html',
  './index.html',
  './home.html',
  './Q&A.html',
  './play.html',
  './announce.html',
  './channel.html',
  './manifest.json',
  './maskable_icon_x192.png',
  './maskable_icon_x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  // add your own .js and .css files here if they exist
  // './app.js', './style.css', etc.
];

const API_BASE = 'https://script.google.com/macros/s/AKfycbwsbPqeRiqW2it0f1UpTNMRba_YQ5KO7wo2syRn_u7CvxM5oEyct6n9zq0lntfbRTm4/exec';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Installing ${CACHE_NAME}`);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ───────────────────────────────────────
  // 1. Google Apps Script API endpoints
  // ───────────────────────────────────────
  if (url.href.startsWith(API_BASE)) {

    if (event.request.method === 'GET') {

      // ── Cache-first + stale-while-revalidate + good offline placeholder
      event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
          return cache.match(event.request).then(cached => {

            const fetchPromise = fetch(event.request)
              .then(response => {
                // Only cache successful JSON responses
                if (response?.status === 200 && 
                    response.headers.get('content-type')?.includes('application/json')) {
                  cache.put(event.request, response.clone());
                }
                return response;
              })
              .catch(() => {
                // ── Fallback when both cache & network fail
                if (cached) {
                  // We already have something → return it (stale is better than nothing)
                  return cached;
                }

                // Nothing cached before → return structured offline response
                return new Response(
                  JSON.stringify({
                    success: false,
                    status: "offline",
                    offline: true,
                    message: "Offline mode — showing last known data or empty state",
                    // Add sensible defaults for most views
                    channels: [],
                    games: [],
                    questions: [],
                    choices: [],
                    leaderboard: [],
                    announcements: [{
                      id: "sys-offline",
                      title: "You're offline",
                      content: "Last known data is being shown.\nSome features are limited until you reconnect.",
                      created: new Date().toISOString(),
                      creator: "System",
                      pinned: true
                    }],
                    comments: [],
                    viewCounts: {},
                    userStatus: "pending",
                    // ... add more defaults when needed
                  }),
                  {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                  }
                );
              });

            // Return cache OR network (classic cache-first)
            return cached || fetchPromise;
          });
        })
      );

      return;
    }

    // ── POST / PUT / DELETE → network-first + graceful offline rejection
    if (['POST','PUT','PATCH','DELETE'].includes(event.request.method)) {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              status: "offline",
              offline: true,
              message: "Cannot modify data while offline.\nAction will be retried later (background sync coming soon)."
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
      return;
    }
  }

  // ───────────────────────────────────────
  // 2. HTML navigation requests
  // ───────────────────────────────────────
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request) || caches.match('./home.html'))
    );
    return;
  }

  // ───────────────────────────────────────
  // 3. Everything else (css, js, images, fonts…) → cache-first + background update
  // ───────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchAndCache = fetch(event.request).then(response => {
        if (response?.status === 200 && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => new Response('', { status: 503 }));

      return cached || fetchAndCache;
    })
  );
});