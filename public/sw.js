// Service Worker — مدرسة الرفعة النموذجية PWA
// يدعم العمل في حالة الإنترنت الضعيف أو المنقطع

const CACHE_NAME = 'rafaa-school-v1'
const OFFLINE_URL = '/offline'

// الملفات التي تُخزَّن مسبقاً
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// التثبيت: خزّن الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // لا نوقف التثبيت إذا فشل تحميل بعض الملفات
      })
    }).then(() => self.skipWaiting())
  )
})

// التفعيل: احذف الكاشات القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// الطلبات: استراتيجية Network First مع Offline Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // تجاهل طلبات Supabase — يجب أن تكون Real-time دائماً
  if (url.hostname.includes('supabase.co')) return

  // للصفحات: Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL) || caches.match('/')
      )
    )
    return
  }

  // للملفات الثابتة: Cache First
  if (request.destination === 'image' || request.destination === 'font' ||
      url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return response
        }).catch(() => cached || new Response('', { status: 503 }))
      })
    )
    return
  }
})

// Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'إشعار جديد', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'مدرسة الرفعة', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'default',
      data: { url: data.url || '/dashboard' },
      actions: data.url ? [{ action: 'open', title: 'عرض' }] : [],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find(c => c.url.includes(url))
      if (existingClient) return existingClient.focus()
      return clients.openWindow(url)
    })
  )
})
