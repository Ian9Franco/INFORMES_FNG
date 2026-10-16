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
    const entries=reviews.flatMap(review => validReviewActions(review.actionEntries) ? review.actionEntries.map(entry => ({ entry, date: review.date })) : []).filter(({entry}) => entryService(entry) === service)
    const groups=new Map<string,typeof entries>()
    for(const item of entries) {
      // Keep the registration date of each programming event, especially in monthly reports.
      const key=isScheduledAction(item.entry.typeId) ? `${item.entry.typeId}:${item.date}` : item.entry.typeId
      groups.set(key,[...(groups.get(key)??[]),item])
    }
    const parts=[...groups.values()].map(items => {
      const type=items[0].entry.typeId
      const quantity=items.reduce((sum,item) => sum+item.entry.quantity,0)
      const observed=items.some(item => item.entry.evidence==='observed') ? '?' : ''
      if(isScheduledAction(type)) {
        const days=STORY_DAYS.filter(day => items.some(item => item.entry.scheduledDays?.includes(day.id))).map(day => day.label).join(', ')
        const noun=type==='meta.story.scheduled' ? quantity===1?'historia programada':'historias programadas' : quantity===1?'publicación programada':'publicaciones programadas'
        const registered=items[0].date.split('-').reverse().join('/')
        return `${quantity} ${noun} para ${days} (registro ${registered})${observed ? ' · por confirmar' : ''}`
      }
      return `${codes[type] ?? entryDefinition(items[0].entry)!.label}${compact ? '' : ' ×'}${quantity}${observed}`
    })
    return parts.length ? [`${serviceCode(service)}${compact ? ' ' : ' · '}${parts.join(compact ? ' ' : ' · ')}`] : []
  })
}
export function simpleActionLegend(reviews: Review[]): string {
  const labels=new Map<string,string>()
  for(const review of reviews) for(const entry of validReviewActions(review.actionEntries) ? review.actionEntries : []) {
    const code=codes[entry.typeId]
    if(code && !isScheduledAction(entry.typeId)) labels.set(code,entryDefinition(entry)!.label)
  }
  return [
    'MA: Meta Ads · G: Google Ads · MO: Meta orgánico.',
    labels.size ? [...labels].map(([code,label]) => `${code}: ${label}`).join(' · ') : '',
    'Número = cantidad (An+2 = 2 anuncios añadidos). (Sáb/Dom) = días programados. ✓: revisado / !: con incidencia / ?: por confirmar / ·: sin revisar.',
    reviews.some(review => review.issues?.some(issue => issue.type === 'client_paused')) ? 'P: campañas apagadas por decisión del cliente (no es un error).' : '',
    reviews.some(review => review.actionEntries?.some(entry => isScheduledAction(entry.typeId))) ? 'Programado ≠ publicado. «Para» indica el día previsto; «registro», cuándo se anotó.' : '',
  ].filter(Boolean).join('\n')
}
