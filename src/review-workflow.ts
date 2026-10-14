import type { Client, Review } from './data'
import { validReviewActions, type ReviewAction } from './review-actions.ts'

export type ReviewFields = { actions: string; observations: string; actionEntries: ReviewAction[]; pendingText: string }
export type ReviewDraft = ReviewFields & { clientId: string; day: string; base?: Review; updatedAt: string }
export type ReviewDrafts = Record<string, ReviewDraft>
export const draftKey = (clientId: string, day: string) => `${clientId}:${day}`
export const reviewSignature = (review?: Review) => JSON.stringify(review ? { id: review.id, actions: review.actions, observations: review.observations, actionEntries: review.actionEntries ?? [] } : null)
export const draftChanged = (draft: ReviewDraft) => draft.actions !== (draft.base?.actions ?? '') || draft.observations !== (draft.base?.observations ?? '') || Boolean(draft.pendingText.trim()) || JSON.stringify(draft.actionEntries) !== JSON.stringify(draft.base?.actionEntries ?? [])

export function readDrafts(storage: Pick<Storage, 'getItem'>, key: string): ReviewDrafts {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([key, item]) => {
      const draft = item as ReviewDraft
      return draft && typeof draft.clientId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.day) && key === draftKey(draft.clientId, draft.day) && typeof draft.actions === 'string' && typeof draft.observations === 'string' && typeof draft.pendingText === 'string' && typeof draft.updatedAt === 'string' && validReviewActions(draft.actionEntries) && (!draft.base || (draft.base.clientId === draft.clientId && draft.base.date === draft.day && typeof draft.base.id === 'string' && typeof draft.base.actions === 'string' && typeof draft.base.observations === 'string'))
    })) as ReviewDrafts
  } catch { return {} }
}

export function nextPendingClient(clients: Client[], reviews: Review[], day: string, currentId: string) {
  const start = clients.findIndex(client => client.id === currentId)
  const candidates = [...clients.slice(start + 1), ...clients.slice(0, Math.max(0, start))]
  return candidates.find(client => client.active && !reviews.some(review => review.clientId === client.id && review.date === day))
}
