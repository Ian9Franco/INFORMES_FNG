import type { Pending, Store } from './data'
import { activePlatforms, platformActive } from './platforms.ts'

/** Tasks are explicit saved follow-ups, not completed actions or unreviewed accounts.
 * They survive period changes; unscoped legacy tasks remain general, exactly once.
 * Archiving hides them without deleting history or completing the task.
 */
export function visiblePendingTasks(store: Store): Pending[] {
  const clients = new Map(store.clients.map(client => [client.id, client]))
  return store.pending.filter(task => {
    const client = clients.get(task.clientId)
    return client && typeof task.text === 'string' && task.text.trim() && (task.service || task.platform ? platformActive(client, task.service ?? task.platform!) : activePlatforms(client).length > 0)
  })
}

export const openPendingTasks = (store: Store): Pending[] => visiblePendingTasks(store).filter(task => !task.resolved)
