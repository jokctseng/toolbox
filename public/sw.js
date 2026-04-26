/* KC Toolbox Service Worker - Background Timer */
const VERSION = 'v1';
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

// Cache app shell for offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
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
      icon: '/favicon.svg',
      tag: 'timer-' + (e.data.id || 0),
      renotify: true,
    });
  }
});
