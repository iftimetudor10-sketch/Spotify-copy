const SHELL_CACHE = 'folio-shell-v1'
const IMAGE_CACHE = 'folio-images-v1'
const SHELL_URLS = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.svg', '/icons/icon-512.svg']
const MAX_IMAGES = 40

self.addEventListener('install', (event) => {
  event.waitUntil(fetch('/precache-manifest.json').then((response) => response.json()).then((assets) => caches.open(SHELL_CACHE).then((cache) => cache.addAll([...SHELL_URLS, ...assets]))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      void caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy))
      return response
    }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/offline.html'))))
    return
  }

  if (request.destination === 'image') {
    event.respondWith(caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) {
          await cache.put(request, response.clone())
          const keys = await cache.keys()
          if (keys.length > MAX_IMAGES) await cache.delete(keys[0])
        }
        return response
      } catch {
        return new Response('', { status: 504, statusText: 'Offline' })
      }
    }))
    return
  }

  if (['script', 'style', 'font'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})