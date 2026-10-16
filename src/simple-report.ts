import type { Review } from './data'
import { entryDefinition, entryService, isScheduledAction, STORY_DAYS, validReviewActions } from './review-actions.ts'
import { WORK_SERVICES, type WorkService } from './work-services.ts'

const codes: Record<string,string> = {
  'meta.ad.created':'An+', 'meta.ad.deleted':'An−', 'meta.ad.updated':'An↻', 'meta.ad.paused':'Pausa',
  'meta.campaign.created':'Camp', 'meta.adset.created':'Conj', 'meta.budget.updated':'Pres', 'meta.audience.updated':'Aud',
  'meta.story.scheduled':'H', 'meta.post.scheduled':'Feed',
  'google.ad.created':'An+', 'google.ad.deleted':'An−', 'google.ad.updated':'An↻', 'google.campaign.created':'Camp',
  'google.adgroup.created':'Grupo', 'google.keyword.updated':'KW', 'google.keyword.negative_added':'KW−',
  'google.youtube.video_uploaded':'YT', 'google.asset_group.updated':'Rec', 'google.budget.updated':'Pres', 'google.bidding.updated':'Puja',
}
export const serviceCode = (service: WorkService) => service === 'meta_organic' ? 'MO' : service === 'google_ads' ? 'G' : 'MA'
export function simpleActionSummary(reviews: Review[], compact = false): string[] {
  return WORK_SERVICES.flatMap(service => {
    const entries=reviews.flatMap(review => validReviewActions(review.actionEntries) ? review.actionEntries : []).filter(entry => entryService(entry) === service)
    const groups=new Map<string,typeof entries>()
    for(const entry of entries)groups.set(entry.typeId,[...(groups.get(entry.typeId)??[]),entry])
    const parts=[...groups].map(([type,items]) => {
      const quantity=items.reduce((sum,item) => sum+item.quantity,0)
      const days=isScheduledAction(type) ? STORY_DAYS.filter(day => items.some(item => item.scheduledDays?.includes(day.id))).map(day => day.short).join('/') : ''
      const observed=items.some(item => item.evidence==='observed') ? '?' : ''
      return `${codes[type] ?? entryDefinition(items[0])!.label}${compact ? '' : ' ×'}${quantity}${days ? `${compact ? '' : ' '}(${days})` : ''}${observed}`
    })
    return parts.length ? [`${serviceCode(service)}${compact ? ' ' : ' · '}${parts.join(compact ? ' ' : ' · ')}`] : []
  })
}
export function simpleActionLegend(reviews: Review[]): string {
  const labels=new Map<string,string>()
  for(const review of reviews) for(const entry of validReviewActions(review.actionEntries) ? review.actionEntries : []) {
    const code=codes[entry.typeId]
    if(code) labels.set(code,entryDefinition(entry)!.label)
  }
  return [
    'MA: Meta Ads · G: Google Ads · MO: Meta orgánico.',
    labels.size ? [...labels].map(([code,label]) => `${code}: ${label}`).join(' · ') : '',
    'Número = cantidad (An+2 = 2 anuncios añadidos). (Sáb/Dom) = días programados. ✓: revisado / !: con incidencia / ?: por confirmar / ·: sin revisar.',
  ].filter(Boolean).join('\n')
}
