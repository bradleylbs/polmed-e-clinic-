// POLMED Clinic ERP - Service Worker
// Handles offline functionality, background sync, and caching

const CACHE_NAME = 'polmed-clinic-v1';
const API_CACHE_NAME = 'polmed-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.error('[Service Worker] Failed to cache some assets:', error);
          // Don't fail the entire install if some assets fail
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API requests (handled by offline manager)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network first strategy for HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/offline');
            });
        })
    );
    return;
  }

  // Cache first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone and cache the response
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });

            return response;
          });
      })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
});

// Message event - communication with clients
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sync pending data with backend
async function syncPendingData() {
  try {
    console.log('[Service Worker] Starting background sync...');

    // Get auth token from client
    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      console.log('[Service Worker] No active clients, skipping sync');
      return;
    }

    const client = clients[0];
    
    // Request token via message channel
    const messageChannel = new MessageChannel();
    const tokenPromise = new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.token);
      };
    });

    client.postMessage({ type: 'GET_AUTH_TOKEN' }, [messageChannel.port2]);
    const token = await tokenPromise;

    if (!token) {
      console.log('[Service Worker] No auth token available');
      return;
    }

    // Get device ID
    const deviceChannel = new MessageChannel();
    const deviceIdPromise = new Promise((resolve) => {
      deviceChannel.port1.onmessage = (event) => {
        resolve(event.data.deviceId);
      };
    });

    client.postMessage({ type: 'GET_DEVICE_ID' }, [deviceChannel.port2]);
    const deviceId = await deviceIdPromise;

    // Note: The actual sync logic is handled by the offline manager
    // This service worker just triggers the sync event
    
    console.log('[Service Worker] Background sync completed');
    
    // Notify clients
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        count: 0
      });
    });

  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
    throw error; // Re-throw to retry later
  }
}

// Push notification event (future enhancement)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const data = event.data?.json() || {};
  const title = data.title || 'POLMED Clinic';
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'notification',
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

console.log('[Service Worker] Script loaded');
