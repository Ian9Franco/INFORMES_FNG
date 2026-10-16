import type { Store } from './data'
import { activePlatforms, platformActive, scopedReviews } from './platforms.ts'
import { visiblePendingTasks } from './pending-tasks.ts'
import { reviewService } from './work-services.ts'

/** Export visibility is derived, never a deletion of archived historical records. */
export function activeReportStore(store: Store): Store {
  const clients = store.clients.filter(client => activePlatforms(client).length)
  return { ...store, clients, reviews: scopedReviews(store.reviews,store.clients).filter(review => { const client = clients.find(client => client.id === review.clientId); return client && platformActive(client,reviewService(review)) }), pending: visiblePendingTasks(store) }
}

/** One basename for both native PDF printing and PNG, independent of the visible app title. */
export function reportFileName(title: string, period: 'week' | 'month', date: string, mode: 'grilla' | 'detalle'): string {
  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim() || 'Informe Ian'
  return `${safeTitle} - ${period === 'month' ? 'mensual' : 'semanal'} ${date} - ${mode === 'grilla' ? 'simple' : 'detallado'}`
}
