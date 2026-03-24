// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

// Your actual Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyCuB56TTi5COJnuDmVf6PiGsOjTwvQ0PNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "938830806378",
  appId: "1:938830806378:web:254ed56cba3dc02290f913"
});

const messaging = firebase.messaging();

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const title = payload.notification?.title || payload.data?.title || 'New post in channel';
  const body  = payload.notification?.body  || payload.data?.body  || 'Someone just posted!';

  const options = {
    body: body,
    icon: '/maskable_icon_x192.png',     // your existing icon
    badge: '/maskable_icon_x192.png',
    data: {
      url: payload.data?.click_action || 
           `/channel.html?channelId=${payload.data?.channelId || ''}`
    }
  };

  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/channel.html';

  event.waitUntil(
    clients.openWindow(url)
  );
});