/* KC Toolbox Service Worker - Background Timer + deployment-safe cache */
const VERSION = 'v2';
const CACHE = 'kc-toolbox-' + VERSION;

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const shouldCache = request => {
  const url = new URL(request.url);
  return url.origin === self.location.origin;
};

// Network-first keeps GitHub Pages deployments from serving old JS/CSS forever.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!shouldCache(e.request)) return;

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) await cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })
  );
});

// Timer tick messages from clients
self.addEventListener('message', e => {
  if (e.data?.type === 'TIMER_TICK') {
    // Broadcast tick to all clients
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'TICK', ts: Date.now() }));
    });
  }
  if (e.data?.type === 'TIMER_ALERT') {
    self.registration.showNotification(e.data.title || 'KC 計時器', {
      body: e.data.body || '時間到！',
      tag: 'timer-' + (e.data.id || 0),
      renotify: true,
    });
  }
});
