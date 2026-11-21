/* Lernzentrale – Service Worker: App offline verfügbar machen.
   Alle Pfade relativ, damit die App auch unter einer Unteradresse läuft (z. B. GitHub Pages /lernzentrale/).
   Kein start_url im Manifest: So startet die App vom Home-Bildschirm mit dem persönlichen Link (?p=…). */
const VERSION = "lz-16";
const BASE = self.registration.scope;
const u = (p) => new URL(p, BASE).href;
const SHELL = ["index.html", "styles.css?v=16", "content.js?v=16", "app.js?v=16", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map(u);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;
  if (req.mode === "navigate") {
    // Seite: erst Netz (für Updates), sonst gespeicherte Fassung
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(u("index.html"), c)); return r; })
      .catch(() => caches.match(u("index.html"))));
    return;
  }
  if (url.origin === location.origin || url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    // Eigene Dateien und Schrift: Speicher zuerst, im Hintergrund auffrischen
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
