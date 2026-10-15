import type { Store } from './data'
import { activePlatforms, platformActive, scopedReviews } from './platforms.ts'

/** Export visibility is derived, never a deletion of archived historical records. */
export function activeReportStore(store: Store): Store {
  const clients = store.clients.filter(client => activePlatforms(client).length)
  const ids = new Set(clients.map(client => client.id))
  return { ...store, clients, reviews: scopedReviews(store.reviews,store.clients).filter(review => { const client = clients.find(client => client.id === review.clientId); return client && platformActive(client,review.platform!) }), pending: store.pending.filter(item => ids.has(item.clientId) && (!item.platform || platformActive(clients.find(client => client.id === item.clientId)!,item.platform))) }
}

/** One basename for both native PDF printing and PNG, independent of the visible app title. */
export function reportFileName(title: string, period: 'week' | 'month', date: string, mode: 'grilla' | 'detalle'): string {
  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim() || 'Informe Ian'
  return `${safeTitle} - ${period === 'month' ? 'mensual' : 'semanal'} ${date} - ${mode === 'grilla' ? 'simple' : 'detallado'}`
}
