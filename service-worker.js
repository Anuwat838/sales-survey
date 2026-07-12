/* SO & Feedback — Service Worker */
const CACHE = 'so-feedback-v1';

// ไฟล์หลักของแอป (same-origin) ที่ precache ไว้ให้เปิด offline ได้
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // ใช้ allSettled กันกรณีไฟล์ใดไฟล์หนึ่งโหลดพลาด จะได้ไม่ทำให้ติดตั้ง SW ล้มทั้งชุด
      Promise.allSettled(CORE.map(u => cache.add(new Request(u, { cache: 'reload' }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) ห้าม cache API ของ Google Apps Script / Sheets — ให้วิ่งเน็ตตรงเสมอ
  //    (แอปมี cache ใน localStorage ของตัวเองอยู่แล้ว การ cache ที่นี่จะทำให้ข้อมูลค้าง)
  if (url.hostname.indexOf('script.google.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1 ||
      url.hostname.indexOf('script.googleusercontent.com') !== -1) {
    return; // ปล่อยให้ browser จัดการตามปกติ (network)
  }

  // 2) หน้า HTML (navigate) — network-first, ถ้าออฟไลน์ค่อย fallback ไป cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 3) asset อื่นๆ (JS/CSS/รูป/ฟอนต์/CDN) — cache-first แล้วค่อยเติม cache
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
    })
  );
});
