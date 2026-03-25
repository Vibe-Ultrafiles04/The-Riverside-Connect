// firebase-messaging-sw.js   ← Place this in the same folder as sw.js and channel.html
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCuB56TTi5COJnuDmVf6PiGsOjTwvQ0PNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "938830806378",
  appId: "1:938830806378:web:254ed56cba3dc02290f913"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message received:", payload);

  self.registration.showNotification(
    payload.notification?.title || "New post in Riverside Connect",
    {
      body: payload.notification?.body || "Someone posted something new in a channel!",
      icon: "./maskable_icon_x192.png",
badge: "./maskable_icon_x192.png",
      data: {
        url: "/my-pwa-demo/channel.html"                   // ← Fixed path
      }
    }
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/my-pwa-demo/channel.html";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});