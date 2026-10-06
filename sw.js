// Service worker de PartyHub : toujours la dernière version du site.
//
// Problème réglé : les téléphones gardaient d'anciens fichiers JS/CSS en cache après une mise
// à jour (et on ne peut pas faire Ctrl+F5 sur un téléphone).
// Règle : pour les fichiers du site, on demande TOUJOURS au serveur s'il y a du nouveau
// (cache: "no-cache" → le serveur répond « 304 inchangé » si rien n'a bougé, c'est léger).
// Si le réseau coupe, on sert la dernière copie connue.
// Firebase et les polices (autres domaines) ne passent pas par ici.

const CACHE = "partyhub-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-cache" });
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
