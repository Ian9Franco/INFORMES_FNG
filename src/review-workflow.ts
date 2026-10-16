import type { Client, Review } from './data'
import { entryService, validReviewActions, type ReviewAction } from './review-actions.ts'
import { PLATFORMS, scopedReviews } from './platforms.ts'
import { validReviewIssues, type ReviewIssue } from './review-issues.ts'
import { reviewService, type WorkService } from './work-services.ts'

export type ReviewFields = { actions: string; observations: string; actionEntries: ReviewAction[]; issues?: ReviewIssue[]; pendingText: string }
export type ReviewDraft = ReviewFields & { clientId: string; day: string; platform?: WorkService; serviceVersion?: 1; base?: Review; updatedAt: string }
export type ReviewDrafts = Record<string, ReviewDraft>
export const draftKey = (clientId: string, day: string, platform?: WorkService) => `${clientId}:${day}${platform ? `:${platform}` : ''}`
export const reviewSignature = (review?: Review) => JSON.stringify(review ? { id: review.id, service: reviewService(review), platform: review.platform, issues: review.issues ?? [], actions: review.actions, observations: review.observations, actionEntries: review.actionEntries ?? [] } : null)
export const draftChanged = (draft: ReviewDraft) => draft.actions !== (draft.base?.actions ?? '') || draft.observations !== (draft.base?.observations ?? '') || Boolean(draft.pendingText.trim()) || JSON.stringify(draft.actionEntries) !== JSON.stringify(draft.base?.actionEntries ?? []) || JSON.stringify(draft.issues ?? []) !== JSON.stringify(draft.base?.issues ?? [])

export function readDrafts(storage: Pick<Storage, 'getItem'>, key: string): ReviewDrafts {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const valid = Object.entries(value).filter(([key, item]) => {
      const draft = item as ReviewDraft
      return draft && typeof draft.clientId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.day) && (!draft.platform || PLATFORMS.includes(draft.platform)) && key === draftKey(draft.clientId, draft.day, draft.platform) && typeof draft.actions === 'string' && typeof draft.observations === 'string' && typeof draft.pendingText === 'string' && typeof draft.updatedAt === 'string' && validReviewActions(draft.actionEntries) && (draft.issues === undefined || validReviewIssues(draft.issues)) && (!draft.base || (draft.base.clientId === draft.clientId && draft.base.date === draft.day && typeof draft.base.id === 'string' && typeof draft.base.actions === 'string' && typeof draft.base.observations === 'string'))
    }) as [string,ReviewDraft][]
    const result: ReviewDrafts = Object.fromEntries(valid.filter(([,draft])=>draft.platform && draft.serviceVersion === 1))
    for(const [,draft] of valid.filter(([,draft])=>draft.serviceVersion !== 1 || !draft.platform)) {
      const found=PLATFORMS.filter(platform=>draft.actionEntries.some(entry=>entryService(entry)===platform))
      const platforms: WorkService[]=found.length?found:[draft.platform ?? 'meta_ads']
      for(const platform of platforms) {
        const key=draftKey(draft.clientId,draft.day,platform)
        if(result[key])continue
        result[key]={...draft,platform,serviceVersion:1,issues:platform===platforms[0]?draft.issues:[],actions:platform===platforms[0]?draft.actions:'',observations:platform===platforms[0]?draft.observations:'',pendingText:platform===platforms[0]?draft.pendingText:'',actionEntries:draft.actionEntries.filter(entry=>entryService(entry)===platform),base:draft.base?scopedReviews([draft.base],[]).find(review=>reviewService(review)===platform):undefined}
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
