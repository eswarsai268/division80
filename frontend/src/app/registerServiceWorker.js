/** PWA shell only (production). The worker never caches /api responses. */
export function registerServiceWorker() {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
  }
}
