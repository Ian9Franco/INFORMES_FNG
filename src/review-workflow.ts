import type { AdPlatform, Client, Review } from './data'
import { entryDefinition, validReviewActions, type ReviewAction } from './review-actions.ts'
import { PLATFORMS, scopedReviews } from './platforms.ts'

export type ReviewFields = { actions: string; observations: string; actionEntries: ReviewAction[]; pendingText: string }
export type ReviewDraft = ReviewFields & { clientId: string; day: string; platform?: AdPlatform; base?: Review; updatedAt: string }
export type ReviewDrafts = Record<string, ReviewDraft>
export const draftKey = (clientId: string, day: string, platform?: AdPlatform) => `${clientId}:${day}${platform ? `:${platform}` : ''}`
export const reviewSignature = (review?: Review) => JSON.stringify(review ? { id: review.id, platform: review.platform, actions: review.actions, observations: review.observations, actionEntries: review.actionEntries ?? [] } : null)
export const draftChanged = (draft: ReviewDraft) => draft.actions !== (draft.base?.actions ?? '') || draft.observations !== (draft.base?.observations ?? '') || Boolean(draft.pendingText.trim()) || JSON.stringify(draft.actionEntries) !== JSON.stringify(draft.base?.actionEntries ?? [])

export function readDrafts(storage: Pick<Storage, 'getItem'>, key: string): ReviewDrafts {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const valid = Object.entries(value).filter(([key, item]) => {
      const draft = item as ReviewDraft
      return draft && typeof draft.clientId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.day) && (!draft.platform || ['meta_ads','google_ads'].includes(draft.platform)) && key === draftKey(draft.clientId, draft.day, draft.platform) && typeof draft.actions === 'string' && typeof draft.observations === 'string' && typeof draft.pendingText === 'string' && typeof draft.updatedAt === 'string' && validReviewActions(draft.actionEntries) && (!draft.base || (draft.base.clientId === draft.clientId && draft.base.date === draft.day && typeof draft.base.id === 'string' && typeof draft.base.actions === 'string' && typeof draft.base.observations === 'string'))
    }) as [string,ReviewDraft][]
    const result: ReviewDrafts = Object.fromEntries(valid.filter(([,draft])=>draft.platform))
    for(const [,draft] of valid.filter(([,draft])=>!draft.platform)) {
      const found=PLATFORMS.filter(platform=>draft.actionEntries.some(entry=>entryDefinition(entry)?.platform===platform))
      const platforms: AdPlatform[]=found.length?found:['meta_ads']
      for(const platform of platforms) {
        const key=draftKey(draft.clientId,draft.day,platform)
        if(result[key])continue
        result[key]={...draft,platform,actions:platform===platforms[0]?draft.actions:'',observations:platform===platforms[0]?draft.observations:'',pendingText:platform===platforms[0]?draft.pendingText:'',actionEntries:draft.actionEntries.filter(entry=>entryDefinition(entry)?.platform===platform),base:draft.base?scopedReviews([draft.base],[]).find(review=>review.platform===platform):undefined}
      }
    }
    return result
  } catch { return {} }
}

export function nextPendingClient(clients: Client[], reviews: Review[], day: string, currentId: string) {
  const start = clients.findIndex(client => client.id === currentId)
  const candidates = [...clients.slice(start + 1), ...clients.slice(0, Math.max(0, start))]
  return candidates.find(client => client.active && !reviews.some(review => review.clientId === client.id && review.date === day))
}
