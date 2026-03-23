"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        function (registration) {
          console.log("Service Worker registration successful with scope: ", registration.scope);
          // Request Push Notification permission if supported
          if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
          }
        },
        function (err) {
          console.log("Service Worker registration failed: ", err);
        }
      );
    }
  }, []);

  return null;
}
