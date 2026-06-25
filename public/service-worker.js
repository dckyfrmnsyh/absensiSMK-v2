const CACHE_NAME = 'absensi-pkl-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[ServiceWorker] Gagal cache beberapa aset, melanjutkan registrasi:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let network first / cache fallback handle asset delivery
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Return fallback if needed or simply let it fail
      });
    })
  );
});

// Sync request listener for service worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'ABSENSI_SYNC_REQUEST') {
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'ABSENSI_SYNC_REQUEST' });
      });
    });
  }

  // Handle direct test notification trigger
  if (event.data.type === 'TEST_NOTIFICATION') {
    const title = event.data.title || 'Uji Coba Notifikasi';
    const body = event.data.body || 'Notifikasi dari sistem Absensi PKL berjalan dengan sukses!';
    showReminderNotification(title, body);
  }
});

// Daily reminders at 07:00 (Masuk) and 16:00 (Keluar)
let lastNotificationDateMasuk = '';
let lastNotificationDateKeluar = '';

function checkDailyReminders() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const dateStr = now.toDateString(); // e.g. "Thu Jun 25 2026"

  // 07:00 (Absen Masuk)
  if (hours === 7 && minutes === 0 && lastNotificationDateMasuk !== dateStr) {
    lastNotificationDateMasuk = dateStr;
    showReminderNotification(
      'Waktunya Absen Masuk!',
      'Selamat pagi! Jangan lupa melakukan absen masuk magang hari ini.'
    );
  }

  // 16:00 (Absen Keluar)
  if (hours === 16 && minutes === 0 && lastNotificationDateKeluar !== dateStr) {
    lastNotificationDateKeluar = dateStr;
    showReminderNotification(
      'Waktunya Absen Keluar!',
      'Selamat sore! Jangan lupa melakukan absen keluar magang sebelum pulang.'
    );
  }
}

function showReminderNotification(title, body) {
  const options = {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    tag: 'daily-reminder',
    renotify: true,
    data: {
      url: '/'
    },
    actions: [
      { action: 'absen', title: 'Buka Presensi' }
    ]
  };

  self.registration.showNotification(title, options).catch((err) => {
    console.error('[ServiceWorker] Gagal menampilkan notifikasi:', err);
  });
}

// Run time check every 30 seconds
setInterval(checkDailyReminders, 30000);

// Handle push notification events from push server
self.addEventListener('push', (event) => {
  let data = { title: 'Absensi PKL', body: 'Pengingat otomatis untuk absensi Anda.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Absensi PKL', body: event.data.text() };
    }
  }

  showReminderNotification(data.title, data.body);
});

// Handle notification click action
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
