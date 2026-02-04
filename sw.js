// sw.js — Improved offline-first PWA support for DC Riverside Chat (2026 edition)
// Version bump required when HTML/CSS/JS or manifest changes

const CACHE_NAME = 'Riverside-Connect-v3';   // ← bumped version for new dynamic caching logic

const STATIC_ASSETS = [
  './',                // Current directory
  './login.html',      // Relative path
  './index.html',
  './announce.html',
  './manifest.json',
  './maskable_icon_x192.png',
  './maskable_icon_x512.png'
];

// Names of other caches we want to keep
const EXPECTED_CACHES = [CACHE_NAME];

const API_BASE = 'https://script.google.com/macros/s/AKfycbwsbPqeRiqW2it0f1UpTNMRba_YQ5KO7wo2syRn_u7CvxM5oEyct6n9zq0lntfbRTm4/exec';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Installing v' + CACHE_NAME + ' — caching core assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting → new service worker activates immediately
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
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
      // Take control of all open clients immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ────────────────────────────────────────────────
  // 1. Handle Google Apps Script API calls
  // ────────────────────────────────────────────────
  if (url.href.startsWith(API_BASE)) {

    // GET requests (mainly ?operation=getData) → cache-first + network fallback
    if (event.request.method === 'GET') {
      event.respondWith(
        caches.match(event.request).then(cached => {
          // Return cached data immediately (offline support for comments)
          if (cached) {
            // Try to update cache in background (stale-while-revalidate)
            fetch(event.request)
              .then(fresh => {
                if (fresh && fresh.status === 200) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, fresh.clone());
                  });
                }
              })
              .catch(() => {}); // silent fail

            return cached;
          }

          // No cache → go to network and cache if successful
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          }).catch(() => {
            // Offline fallback — structured response your frontend can detect
            return new Response(
              JSON.stringify({
                status: 'offline',
                offline: true,
                comments: [], // empty array so frontend doesn't crash
                announcements: [],
                message: 'You are offline. Showing last known messages (if previously loaded).'
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
      );
      return;
    }

    // POST/DELETE (postComment, deleteComment, etc.) → always network-first
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            status: 'offline',
            message: 'Cannot send, edit or delete messages while offline.'
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
  // 2. Navigation & HTML pages → network-first + cache fallback
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
  // 3. Everything else → cache-first + stale-while-revalidate
  // ────────────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Background revalidation
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
          })
          .catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          event.request.method !== 'GET' ||
          networkResponse.type === 'opaque'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html')
            .then(r => r || new Response(
              '<h1>Offline</h1><p>Please reconnect to use the chat.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            ));
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// Optional: listen for background sync (future use)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  console.log('[SW] Background sync triggered — messages pending');
}