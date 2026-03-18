// sw.js — Powerful offline-first PWA support for Riverside Connect (WhatsApp-style)
// Now caches comments, announcements, view counts & approval status

const CACHE_NAME = 'Riverside-Connect-v5';   // ← bumped version for announcements + view counts

// sw.js — Custom service worker for Riverside Connect (handles push + optional caching)


// ────────────────────────────────────────────────
// FIREBASE MESSAGING — REQUIRED for background push notifications
// This block MUST be at the very top
// ────────────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCuB56TTi5COJnuDm6fPigsOsJTwvQwPPNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "9388830806378",
  appId: "1:9388830806378:web:254ed56cba3dc02290f913"
});

const messaging = firebase.messaging();

// Handle background push notifications (when app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message: ', payload);

  // Customize the notification (you can pull from payload.data too)
  const notificationTitle = payload.notification?.title || 'New post in channel';
  const notificationOptions = {
    body: payload.notification?.body || 'Check the latest update',
    icon: '/maskable_icon_x192.png',     // your app icon (must exist in root)
    badge: '/maskable_icon_x192.png',
    data: payload.data || {}             // pass channelId etc. for click handling later
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: your own SW lifecycle events (good for debugging)
self.addEventListener('install', event => {
  console.log('[sw.js] Installed');
  // You can add caching logic here later if needed
});

self.addEventListener('activate', event => {
  console.log('[sw.js] Activated');
});

const STATIC_ASSETS = [
  './',
  './login.html',
  './user.html',
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
];

const API_CACHE_PATTERNS = [
  '?operation=getAllQnAChannels',
  '?operation=getQnAGames',
  '?operation=getQnAQuestionsAndChoices',
  '?operation=getQnALeaderboard',
  '?operation=getSurveyResults',
  '?operation=getSurveyParticipants',
];

const EXPECTED_CACHES = [CACHE_NAME];

const API_BASE = 'https://script.google.com/macros/s/AKfycbzR81XMvvwBz8CW-j_Oq3j6ww9kmBssVeCwW9gFnHfZlbwlfUUbNgGsapdPDWhZkaRh/exec';

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

  if (url.href.startsWith(API_BASE)) {

  // ────────────────────────────────────────────────
  // GET requests → cache-first + stale-while-revalidate pattern
  // ────────────────────────────────────────────────
if (event.request.method === 'GET') {

  // ── Only cache these specific Q&A API calls (and announcements/comments if you want)
  const isCacheableApiCall = API_CACHE_PATTERNS.some(pattern => 
    event.request.url.includes(pattern)
  );

  // You can also add announcement/comment patterns here if needed
  // const isAnnouncementRelated = event.request.url.includes('getAnnouncements') || event.request.url.includes('getComments');

  if (!isCacheableApiCall /* && !isAnnouncementRelated */) {
    // Let it go through normal network-first or whatever your current logic is
    // (or just skip special caching for other endpoints)
    return; // or continue with default fetch
  }

  // ── Only if it's one of our important patterns → do the cache-first logic
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const networkedFetch = fetch(event.request)
          .then(freshResponse => {
            if (freshResponse && freshResponse.status === 200 && 
                freshResponse.headers.get('content-type')?.includes('application/json')) {
              cache.put(event.request, freshResponse.clone());
            }
            return freshResponse;
          })
          .catch(() => {
            // your nice fallback object here
            return new Response(
              JSON.stringify({
                status: "offline",
                offline: true,
                userStatus: "pending",
                comments: [],
                announcements: [{
                  id: "offline-notice-1",
                  title: "Offline Mode",
                  content: "You are currently offline.\n\nShowing last known data if previously loaded.\n\nConnect to see latest announcements, channels, games, etc.",
                  created: new Date().toISOString(),
                  creator: "System",
                  pinned: true
                }],
                viewCounts: [],
                announcementsViewCounts: [],
                channels: [],
                games: [],
                questions: [],
                leaders: [],
                results: [],
                participants: [],
                message: "Offline — last known data or placeholder"
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          });

        return cachedResponse || networkedFetch;
      });
    })
  );
  return;
}
  // ────────────────────────────────────────────────
  // POST / mutations (create channel, create game, submit score, delete game, post announcement, etc.)
  // → network-first, graceful offline failure
  // ────────────────────────────────────────────────
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        JSON.stringify({
          status: "offline",
          offline: true,
          message: "Cannot create, delete, submit scores, post announcements or modify data while offline. Action will be retried when you reconnect."
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

// ────────────────────────────────────────────────
// FCM PUSH NOTIFICATIONS
// ────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = {};
  if (event.data) payload = event.data.json();

  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || 'Riverside Connect';
  const options = {
    body: notif.body || 'New channel post',
    icon: notif.icon || './maskable_icon_x192.png',
    data: data   // contains url & channelId
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data.url || './channel.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus().then(c => c.navigate(url));
        }
        return clients.openWindow(url);
      })
  );
});