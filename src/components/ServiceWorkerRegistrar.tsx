"use client";

import { useEffect } from "react";

/* ============================================================
   ServiceWorkerRegistrar — P15.1 PWA install.

   Registers /sw.js after the window load event so the service
   worker never competes with first paint. Render-null; it exists
   purely for the registration side-effect. Production-only — a SW
   in `next dev` interferes with HMR, so we no-op outside prod.

   The worker itself (public/sw.js) only precaches the static app
   shell for installability/offline-shell. Authed-data offline
   reads are P15.4.
   ============================================================ */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = (): void => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure must never break the app — installability
        // is progressive enhancement. Swallow silently.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
