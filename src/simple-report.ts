import type { Review } from './data'
import { entryDefinition, entryService, formatDayQuantities, isScheduledAction, STORY_DAYS, validReviewActions, type ReviewAction } from './review-actions.ts'
import { serviceLabel, WORK_SERVICES, type WorkService } from './work-services.ts'

/** Reader-facing phrases. The person who opens the report did not write it. */
const READER_PHRASES: Record<string, readonly [string, string]> = {
  'meta.ad.created': ['anuncio añadido', 'anuncios añadidos'],
  'meta.ad.deleted': ['anuncio eliminado', 'anuncios eliminados'],
  'meta.ad.updated': ['anuncio actualizado', 'anuncios actualizados'],
  'meta.ad.paused': ['anuncio pausado', 'anuncios pausados'],
  'meta.campaign.created': ['campaña creada', 'campañas creadas'],
  'meta.adset.created': ['conjunto de anuncios creado', 'conjuntos de anuncios creados'],
  'meta.budget.updated': ['presupuesto ajustado', 'presupuestos ajustados'],
  'meta.audience.updated': ['audiencia actualizada', 'audiencias actualizadas'],
  'google.ad.created': ['anuncio añadido', 'anuncios añadidos'],
  'google.ad.deleted': ['anuncio eliminado', 'anuncios eliminados'],
  'google.ad.updated': ['anuncio actualizado', 'anuncios actualizados'],
  'google.campaign.created': ['campaña creada', 'campañas creadas'],
  'google.adgroup.created': ['grupo de anuncios creado', 'grupos de anuncios creados'],
  'google.keyword.updated': ['palabra clave actualizada', 'palabras clave actualizadas'],
  'google.keyword.negative_added': ['palabra clave negativa añadida', 'palabras clave negativas añadidas'],
  'google.youtube.video_uploaded': ['video subido a YouTube', 'videos subidos a YouTube'],
  'google.asset_group.updated': ['grupo de recursos actualizado', 'grupos de recursos actualizados'],
  'google.budget.updated': ['presupuesto ajustado', 'presupuestos ajustados'],
  'google.bidding.updated': ['puja actualizada', 'pujas actualizadas'],
}

export function readerActionText(entry: ReviewAction, registeredDate?: string): string {
  const pending = entry.evidence === 'observed' ? ' · por confirmar' : ''
  const noted = registeredDate ? ` (anotado el ${registeredDate.split('-').reverse().join('/')})` : ''
  if (entry.typeId === 'meta.story.scheduled' && entry.storyCounts?.length) {
    const split = formatDayQuantities(entry.storyCounts)
    const noun = entry.quantity === 1 ? 'historia' : 'historias'
    return `${entry.quantity} ${noun}: ${split}${noted}${pending}`
  }
  if (isScheduledAction(entry.typeId)) {
    const days = STORY_DAYS.filter(day => entry.scheduledDays?.includes(day.id)).map(day => day.label).join(', ')
    const noun = entry.typeId === 'meta.story.scheduled'
      ? entry.quantity === 1 ? 'historia programada' : 'historias programadas'
      : entry.quantity === 1 ? 'publicación programada' : 'publicaciones programadas'
    return `${entry.quantity} ${noun} para ${days}${noted}${pending}`
  }
  const pair = READER_PHRASES[entry.typeId]
  const phrase = pair
    ? `${entry.quantity} ${entry.quantity === 1 ? pair[0] : pair[1]}`
    : `${entry.quantity} · ${entryDefinition(entry)?.label ?? 'Trabajo registrado'}`
  const until = entry.endsOn ? `, hasta el ${entry.endsOn.split('-').reverse().join('/')}` : ''
  return `${phrase}${until}${pending}`
}

export type ReportActionTag = { key: string; text: string; pending: boolean }
export type ReportActionGroup = { service: WorkService; tags: ReportActionTag[] }

export function reportActionGroups(reviews: Review[]): ReportActionGroup[] {
  return WORK_SERVICES.flatMap(service => {
    const entries = reviews.flatMap(review => validReviewActions(review.actionEntries) ? review.actionEntries.map(entry => ({ entry, date: review.date })) : []).filter(({ entry }) => entryService(entry) === service)
    const groups = new Map<string, typeof entries>()
    for (const item of entries) {
      const key = isScheduledAction(item.entry.typeId) ? `${item.entry.typeId}:${item.date}` : item.entry.endsOn ? `${item.entry.typeId}:${item.entry.endsOn}` : item.entry.typeId
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    const tags = [...groups.entries()].map(([key, items]) => {
      const quantity = items.reduce((sum, item) => sum + item.entry.quantity, 0)
      const pending = items.some(item => item.entry.evidence === 'observed')
      const split = items[0].entry.typeId === 'meta.story.scheduled' && items.every(item => item.entry.storyCounts?.length)
      const storyCounts = split ? STORY_DAYS.flatMap(day => {
        const total = items.reduce((sum, item) => sum + (item.entry.storyCounts?.find(part => part.day === day.id)?.quantity ?? 0), 0)
        return total ? [{ day: day.id, quantity: total }] : []
      }) : undefined
      const sample: ReviewAction = {
        ...items[0].entry,
        quantity: storyCounts ? storyCounts.reduce((sum, part) => sum + part.quantity, 0) : quantity,
        evidence: pending ? 'observed' : 'user_confirmed',
        ...(isScheduledAction(items[0].entry.typeId) ? { scheduledDays: storyCounts ? storyCounts.map(part => part.day) : STORY_DAYS.filter(day => items.some(item => item.entry.scheduledDays?.includes(day.id))).map(day => day.id) } : {}),
        ...(storyCounts ? { storyCounts } : { storyCounts: undefined }),
      }
      return { key, text: readerActionText(sample, isScheduledAction(sample.typeId) ? items[0].date : undefined), pending }
    })
    return tags.length ? [{ service, tags }] : []
  })
}

export function simpleActionSummary(reviews: Review[], _compact = false): string[] {
  return reportActionGroups(reviews).map(group => `${serviceLabel(group.service)} · ${group.tags.map(tag => tag.text).join(' · ')}`)
}

export type ReportRemark = { kind: 'note' | 'comment'; date: string; text: string }
export function reportRemarks(reviews: Review[]): ReportRemark[] {
  return reviews.flatMap(review => {
    const remarks: ReportRemark[] = []
    if (review.actions.trim()) remarks.push({ kind: 'note', date: review.date, text: review.actions.trim() })
    if (review.observations.trim()) remarks.push({ kind: 'comment', date: review.date, text: review.observations.trim() })
    return remarks
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.text.localeCompare(b.text, 'es') : a.kind === 'note' ? -1 : 1))
}

export function simpleActionLegend(reviews: Review[]): string {
  return [
    'Cómo se lee: cada etiqueta dice qué se hizo y cuántas veces. Meta Ads, Google Ads y Meta orgánico se leen por separado. ✓ revisado ese día · ! hubo una incidencia · ? el dato todavía no está confirmado · · ese día no se revisó.',
    reviews.some(review => review.issues?.some(issue => issue.type === 'client_paused')) ? 'P: las campañas están apagadas porque el cliente lo pidió. No es un error.' : '',
    reviews.some(review => review.actionEntries?.some(entry => isScheduledAction(entry.typeId))) ? 'Programar no es publicar. «Anotado» es cuándo se registró; los días son para cuándo sale. En historias, cada número es de ese día.' : '',
  ].filter(Boolean).join('\n')
}
