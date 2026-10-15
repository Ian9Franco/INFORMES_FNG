import type { Store } from './data'

/** Export visibility is derived, never a deletion of archived historical records. */
export function activeReportStore(store: Store): Store {
  const clients = store.clients.filter(client => client.active)
  const ids = new Set(clients.map(client => client.id))
  return { ...store, clients, reviews: store.reviews.filter(review => ids.has(review.clientId)), pending: store.pending.filter(item => ids.has(item.clientId)) }
}

/** One basename for both native PDF printing and PNG, independent of the visible app title. */
export function reportFileName(title: string, period: 'week' | 'month', date: string, mode: 'grilla' | 'detalle'): string {
  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim() || 'Informe Ian'
  return `${safeTitle} - ${period === 'month' ? 'mensual' : 'semanal'} ${date} - ${mode === 'grilla' ? 'simple' : 'detallado'}`
}
