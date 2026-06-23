"use client";

import { useEffect } from "react";

/**
 * Registers the app's service worker (public/sw.js) once, client-side, after
 * the window has loaded so it never competes with the first paint. The worker
 * itself owns the precache + offline strategy (see public/sw.js); this just
 * wires it up — without a register call the worker never installs and the app
 * stays non-installable.
 *
 * Renders nothing. Skipped in dev and for browsers without SW support so the
 * console stays quiet on unsupported platforms.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration must never break the page — the app works
        // fine online without the worker; offline reads just won't be cached.
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
