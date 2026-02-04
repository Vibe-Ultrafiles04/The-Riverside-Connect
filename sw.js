// sw.js — Powerful offline-first PWA support for Riverside Connect (WhatsApp-style)
// Version bump required when HTML/CSS/JS, manifest or logic changes

const CACHE_NAME = 'Riverside-Connect-v4';   // ← bumped version for approval + comments caching

const STATIC_ASSETS = [
  './',
  './login.html',
  './index.html',
  './announce.html',
  './manifest.json',
  './maskable_icon_x192.png',
  './maskable_icon_x512.png'
];

const EXPECTED_CACHES = [CACHE_NAME];

const API_BASE = 'https://script.google.com/macros/s/AKfycbwsbPqeRiqW2it0f1UpTNMRba_YQ5KO7wo2syRn_u7CvxM5oEyct6n9zq0lntfbRTm4/exec';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Installing v' + CACHE_NAME + ' — caching core assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => !EXPECTED_CACHES.includes(key))
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ────────────────────────────────────────────────
  // Handle Google Apps Script API calls (your backend)
  // ────────────────────────────────────────────────
  if (url.href.startsWith(API_BASE)) {

    // GET requests → cache-first (for offline comments & approval status)
    if (event.request.method === 'GET') {
      event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
          return cache.match(event.request).then(cachedResponse => {
            // Return cached data instantly (offline mode)
            if (cachedResponse) {
              // Quietly try to update in background when online
              fetch(event.request)
                .then(freshResponse => {
                  if (freshResponse && freshResponse.status === 200) {
                    cache.put(event.request, freshResponse.clone());
                  }
                })
                .catch(() => {}); // silent fail

              return cachedResponse;
            }

            // No cache yet → network + cache if successful
            return fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            }).catch(() => {
              // Offline fallback — structured response your app can handle
              return new Response(
                JSON.stringify({
                  status: 'offline',
                  offline: true,
                  userStatus: 'pending', // safe default
                  comments: [],
                  announcements: [],
                  message: 'You are offline. Showing last known data.'
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          });
        })
      );
      return;
    }

    // POST/DELETE (send, edit, delete message) → always network-first
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            status: 'offline',
            message: 'Cannot send, edit or delete messages while offline. Will try again when you reconnect.'
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

  // ────────────────────────────────────────────────
  // Navigation & HTML pages → network-first + cache fallback
  // ────────────────────────────────────────────────
  if (event.request.mode === 'navigate' || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // ────────────────────────────────────────────────
  // All other requests (images, CSS, JS, etc.) → cache-first
  // ────────────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request)
          .then(freshResponse => {
            if (freshResponse && freshResponse.status === 200 && event.request.method === 'GET') {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, freshResponse.clone());
              });
            }
          })
          .catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// Future: background sync for pending messages (optional next step)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  console.log('[SW] Background sync triggered — trying to send pending messages');
  // → Add IndexedDB queue reading + sending logic later if needed
}