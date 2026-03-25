// firebase-messaging-sw.js  (place at root)
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyCuB56TTi5COJnuDmVf6PiGsOjTwvQ0PNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "938830806378",
  appId: "1:938830806378:web:254ed56cba3dc02290f913"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message received:", payload);

  const notificationTitle = payload.notification?.title || "New post in Riverside Connect";
  const notificationOptions = {
    body: payload.notification?.body || "Someone posted something new in a channel!",
    icon: "/maskable_icon_x192.png",   // or your preferred icon
    badge: "/maskable_icon_x192.png",
    data: {
      url: payload.data?.click_action || "/channel.html"   // adjust if you send channelId in data
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: handle click (open the app / specific channel)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/channel.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});