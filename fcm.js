// fcm.js - Firebase Cloud Messaging for Riverside Connect PWA
const firebaseConfig = {
  apiKey: "AIzaSyCuB56TTi5COJnuDm6fPigsOsJTwvQwPPNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "9388830806378",
  appId: "1:9388830806378:web:254ed56cba3dc02290f913"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

async function registerPushNotifications(username) {
  if (!username) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const token = await messaging.getToken({
      vapidKey: "BKnSjW0EsGh9Js3fgOP157ltxarDOfwXq8DWo6Xx02QEZbd2ff96iI4FR8bNY91hTLK5rY8k2nH2W0sKQ6rFIuA"   // ← from Firebase Web configuration
    });

    if (token) {
      console.log("[FCM] Token obtained");
      await sendTokenToServer(username, token);

      // Refresh token automatically
      messaging.onTokenRefresh(() => {
        messaging.getToken({ vapidKey: "BKnSjW0EsGh9Js3fgOP157ltxarDOfwXq8DWo6Xx02QEZbd2ff96iI4FR8bNY91hTLK5rY8k2nH2W0sKQ6rFIuA" })
          .then(newToken => sendTokenToServer(username, newToken));
      });
    }
  } catch (err) {
    console.error("[FCM] Error:", err);
  }
}

async function sendTokenToServer(username, token) {
  const payload = {
    operation: "registerFCMToken",
    name: username,
    token: token
  };

  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbwsbPqeRiqW2it0f1UpTNMRba_YQ5KO7wo2syRn_u7CvxM5oEyct6n9zq0lntfbRTm4/exec",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
    const data = await res.json();
    console.log("[FCM] Token registered:", data);
  } catch (e) {
    console.error("[FCM] Failed to send token:", e);
  }
}