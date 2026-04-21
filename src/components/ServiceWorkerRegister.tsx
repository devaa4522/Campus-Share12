"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        function (registration) {
          console.log("Service Worker registration successful with scope: ", registration.scope);
        },
        function (err) {
          console.log("Service Worker registration failed: ", err);
        }
      );
    }

    // Handle BeforeInstallPrompt for PWA installability
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Stash the event so it can be triggered later for a custom install UI
      (window as unknown as { deferredPrompt: Event }).deferredPrompt = e;
      console.log("PWA install prompt captured and deferred.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Log when app is installed
    window.addEventListener("appinstalled", () => {
      console.log("Campus Share PWA installed successfully.");
      (window as unknown as { deferredPrompt: Event | null }).deferredPrompt = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}
