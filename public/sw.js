// Notification receiver only. Do not cache authenticated pages or user API responses.
self.addEventListener('push', event => {
  let message = {}
  try { message = event.data?.json() ?? {} } catch { /* Malformed push uses a generic message. */ }
  event.waitUntil(self.registration.showNotification(message.title || 'Informes FNG', {
    body: message.body || 'Tenés un seguimiento pendiente.',
    tag: message.tag || 'fng-reminder',
    icon: '/icon.svg',
    data: { url: typeof message.url === 'string' ? message.url : '/' },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  let target = new URL('/', self.location.origin)
  try { const requested = new URL(event.notification.data?.url || '/', self.location.origin); if (requested.origin === self.location.origin) target = requested } catch { /* Keep same-origin default. */ }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(window => new URL(window.url).origin === self.location.origin)
    if (existing) { await existing.navigate(target.href); return existing.focus() }
    return self.clients.openWindow(target.href)
  }))
})
