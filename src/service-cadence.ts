import { date, keyDate, monday, type Review } from './data.ts'
import { isScheduledAction } from './review-actions.ts'
import { reviewService, type WorkService } from './work-services.ts'

export const dailyRequired = (service: WorkService, day: string) => service === 'meta_ads' && ![0,6].includes(date(day).getDay())
export const cadenceLabel = (service: WorkService) => service === 'meta_ads' ? 'Revisión de lunes a viernes' : service === 'google_ads' ? '2–3 días por semana · sin días fijos' : 'Programación de sábado/domingo · miércoles a viernes; revisión opcional'
export function weeklyServiceProgress(reviews: Review[], clientId: string, service: WorkService, day: string) {
  const start=monday(date(day)),end=date(start);end.setDate(end.getDate()+7)
  const entries=reviews.filter(review => review.clientId===clientId && reviewService(review)===service && review.date>=start && review.date<keyDate(end))
  const days=new Set(entries.map(review => review.date)).size
  const programmed=entries.some(review => review.actionEntries?.some(entry => isScheduledAction(entry.typeId) && entry.evidence==='user_confirmed' && entry.scheduledDays?.some(day => day==='sat'||day==='sun')))
  return { days, programmed, label: service==='google_ads' ? `${days} ${days===1?'día revisado':'días revisados'} esta semana · referencia: 2–3` : service==='meta_organic' ? programmed ? 'Programación de finde registrada' : 'Sin programación de finde registrada' : `${days} ${days===1?'día revisado':'días revisados'} esta semana` }
}
