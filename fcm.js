// fcm.js — Modern Firebase v10 (non-compat) — March 2026 working version

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyCuB56TTi5COJnuDm6fPigsOsJTwvQwPPNo",
  authDomain: "riverside-connect-a8458.firebaseapp.com",
  projectId: "riverside-connect-a8458",
  storageBucket: "riverside-connect-a8458.firebasestorage.app",
  messagingSenderId: "9388830806378",
  appId: "1:9388830806378:web:254ed56cba3dc02290f913"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const VAPID_KEY = "BKnSjW0EsGh9Js3fgOP157ltxarDOfwXq8DWo6Xx02QEZbd2ff96iI4FR8bNY91hTLK5rY8k2nH2W0sKQ6rFIuA";

export async function registerPushNotifications(username) {
  if (!username) {
    console.warn("[FCM] No username provided");
    return;
  }

  try {
    console.log("[FCM] Requesting permission...");
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("[FCM] Permission not granted:", permission);
      return;
    }

    console.log("[FCM] Permission granted. Getting token...");

    // ── Try to use existing sw.js or register it ────────────────────────────────
let swRegistration;
try {
  // First: check if already registered
  swRegistration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (swRegistration) {
    console.log('[FCM] Reusing existing sw.js registration — scope:', swRegistration.scope);
  } else {
    // Not found → try to register it
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[FCM] Freshly registered sw.js — scope:', swRegistration.scope);
  }
} catch (swErr) {
  console.error('[FCM] Service Worker registration/get failed (this blocks FCM token):', swErr.message);
  
  // Optional fallback: tell user what likely happened
  if (swErr.message.includes('404')) {
    console.error('[FCM] Most likely cause: sw.js file is missing or not served at /sw.js');
    console.error('[FCM] Check: http://127.0.0.1:3000/sw.js should show code, not 404');
  }
  
  return; // ← stop here — no point continuing without SW
}

// Now safely get token
const token = await getToken(messaging, {
  vapidKey: VAPID_KEY,
  serviceWorkerRegistration: swRegistration
});
    console.log('[FCM DEBUG] Raw token result:', token ? token.substring(0, 30) + '...' : 'NULL/UNDEFINED');

    if (token) {
      console.log("[FCM] Token obtained (first 40 chars):", token.substring(0, 40) + "...");
      await sendTokenToServer(username, token);

      // Foreground messages (when page is open)
      onMessage(messaging, (payload) => {
        console.log("[FCM] Foreground message received:", payload);
        // Optional: show custom in-app notification/toast here later
      });
    } else {
      console.warn("[FCM] getToken returned no token. Check: VAPID key, HTTPS, SW active?");
    }
  } catch (err) {
    console.error("[FCM] Full registration error:", err);
    if (err.code) {
      console.error("[FCM] Error code:", err.code);
      console.error("[FCM] Error message:", err.message);
    }
  }
}

async function sendTokenToServer(username, token) {
  const payload = {
    operation: "registerFCMToken",
    name: username,
    token: token
  };

  try {
    console.log("[FCM] Sending token to server...");
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbzR81XMvvwBz8CW-j_Oq3j6ww9kmBssVeCwW9gFnHfZlbwlfUUbNgGsapdPDWhZkaRh/exec",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    console.log("[FCM] Server response:", data);

    if (data.status === "success") {
      console.log("[FCM] Token successfully registered on server");
    } else {
      console.error("[FCM] Server rejected token:", data.message);
    }
  } catch (e) {
    console.error("[FCM] Failed to send token:", e);
  }
}