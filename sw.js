const CACHE_NAME = 'checklist-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for notifications
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(checkReminders());
  }
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Check for due reminders
async function checkReminders() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // App is open, let the main app handle notifications
      return;
    }
    
    // App is closed, check for due reminders
    // This would typically involve reading from IndexedDB
    // For now, we'll let the main app handle all notification logic
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}