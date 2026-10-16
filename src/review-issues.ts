import type { IssueState, Review } from './data'
import { reviewService, serviceShortLabel, type WorkService } from './work-services.ts'

export const ISSUE_TYPES = [{ id: 'no_budget', label: 'Sin presupuesto' }, { id: 'error', label: 'Con error' }] as const
export type ReviewIssue = { type: typeof ISSUE_TYPES[number]['id']; detail?: string }
export function validReviewIssues(value: unknown): value is ReviewIssue[] {
  return Array.isArray(value) && value.length <= 2 && new Set(value.map(item => item?.type)).size === value.length && value.every(item => item && ISSUE_TYPES.some(option => option.id === item.type) && (item.detail === undefined || typeof item.detail === 'string' && item.detail.length <= 600))
}
export const issueText = (issue: ReviewIssue) => `${ISSUE_TYPES.find(option => option.id === issue.type)!.label}${issue.detail?.trim() ? `: ${issue.detail.trim()}` : ''}`
export const reviewIssueText = (review: Pick<Review, 'issues'>) => validReviewIssues(review.issues) ? review.issues.map(issueText).join(' · ') : ''
/** Carry unresolved conditions forward, but an explicit [] on a newer review clears them. */
export function latestIssues(reviews: Review[], clientId: string, service: WorkService, day: string, states: IssueState[] = []): ReviewIssue[] {
  const latest = reviews.filter(review => review.clientId === clientId && reviewService(review) === service && review.date <= day).sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
  const persisted = states.find(state => state.clientId === clientId && state.service === service && state.date <= day)
  if (persisted && (!latest || persisted.date > latest.date || !validReviewIssues(latest.issues)) && validReviewIssues(persisted.issues)) return persisted.issues
  return latest && validReviewIssues(latest.issues) ? latest.issues : []
}
export const issueCellText = (reviews: Review[]) => reviews.flatMap(review => validReviewIssues(review.issues) && review.issues.length ? [`${serviceShortLabel(reviewService(review))}: ${review.issues.map(issue => ISSUE_TYPES.find(option => option.id === issue.type)!.label).join(', ')}`] : []).filter((text,index,all) => all.indexOf(text) === index).join(' · ')
