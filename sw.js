// sw.js — Powerful offline-first PWA support for Riverside Connect (WhatsApp-style)
// Now caches comments, announcements, view counts & approval status

const CACHE_NAME = 'Riverside-Connect-v5';   // ← bumped version for announcements + view counts

const STATIC_ASSETS = [
  './',
  './login.html',
  './index.html',
  './home.html',
  './announce.html',
  './channel.html',
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
  // Handle all Google Apps Script API calls
  // ────────────────────────────────────────────────
  if (url.href.startsWith(API_BASE)) {

    // GET requests → cache-first for offline viewing (comments, announcements, status, views)
    if (event.request.method === 'GET') {
      event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
          return cache.match(event.request).then(cachedResponse => {
            // Return cached data immediately → enables offline comments/announcements/status/views
            if (cachedResponse) {
              // Quietly update cache in background when online
              fetch(event.request)
                .then(freshResponse => {
                  if (freshResponse && freshResponse.status === 200) {
                    cache.put(event.request, freshResponse.clone());
                  }
                })
                .catch(() => {}); // silent fail

              return cachedResponse;
            }

            // No cache yet → fetch from network and cache if successful
            return fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            }).catch(() => {
              // Offline fallback — safe defaults your frontend can handle
              return new Response(
                JSON.stringify({
                  status: 'offline',
                  offline: true,
                  userStatus: 'pending',         // safe default for approval check
                  comments: [],
                  announcements: [],
                  viewCounts: [],                // empty array for view badges
                  announcementsViewCounts: [],   // fallback for announce.html
                  message: 'Offline — showing last known data (comments, announcements, views).'
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

    // POST/DELETE/PUT (postComment, deleteComment, editComment, postAnnouncement, etc.)
    // → always network-first, fail gracefully offline
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            status: 'offline',
            message: 'Cannot send, edit, delete or post while offline. Action will be attempted when you reconnect.'
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
  // All other requests (images, CSS, JS, fonts…) → cache-first + revalidate
  // ────────────────────────────────────────────────
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
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
          return caches.match('./home.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// Future: background sync for pending actions (messages/announcements)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  console.log('[SW] Background sync triggered — attempting to send pending messages/announcements');
  // → Add IndexedDB queue + retry logic here in future if needed
}