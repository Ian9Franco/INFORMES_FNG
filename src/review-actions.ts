/** Immutable integration keys. Labels may change; IDs must never be renamed/reused. */
import { serviceLabel, serviceProvider, type WorkService } from './work-services.ts'
export const ACTION_SCHEMA_VERSION = 1 as const
export type AdPlatform = 'meta_ads' | 'google_ads'
export const STORY_DAYS = [
  { id: 'mon', short: 'Lun', label: 'lunes' }, { id: 'tue', short: 'Mar', label: 'martes' },
  { id: 'wed', short: 'Mié', label: 'miércoles' }, { id: 'thu', short: 'Jue', label: 'jueves' },
  { id: 'fri', short: 'Vie', label: 'viernes' }, { id: 'sat', short: 'Sáb', label: 'sábado' },
  { id: 'sun', short: 'Dom', label: 'domingo' },
] as const
export type StoryDay = typeof STORY_DAYS[number]['id']
export const todayStoryDay = (): StoryDay => STORY_DAYS[(new Date().getDay() + 6) % 7].id
export const ACTION_TYPES = [
  { id: 'meta.ad.created', platform: 'meta_ads', label: 'Añadí anuncios', unit: 'anuncios' },
  { id: 'meta.ad.deleted', platform: 'meta_ads', label: 'Eliminé anuncios', unit: 'anuncios' },
  { id: 'meta.ad.updated', platform: 'meta_ads', label: 'Actualicé anuncios', unit: 'anuncios' },
  { id: 'meta.ad.paused', platform: 'meta_ads', label: 'Pausé anuncios', unit: 'anuncios' },
  { id: 'meta.campaign.created', platform: 'meta_ads', label: 'Creé campañas', unit: 'campañas' },
  { id: 'meta.adset.created', platform: 'meta_ads', label: 'Creé conjuntos', unit: 'conjuntos' },
  { id: 'meta.budget.updated', platform: 'meta_ads', label: 'Ajusté presupuestos', unit: 'ajustes' },
  { id: 'meta.audience.updated', platform: 'meta_ads', label: 'Actualicé audiencias', unit: 'audiencias' },
  { id: 'meta.story.scheduled', platform: 'meta_ads', label: 'Programé historia', unit: 'historias' },
  { id: 'meta.post.scheduled', platform: 'meta_ads', label: 'Programé publicación', unit: 'publicaciones' },
  { id: 'google.ad.created', platform: 'google_ads', label: 'Añadí anuncios', unit: 'anuncios' },
  { id: 'google.ad.deleted', platform: 'google_ads', label: 'Eliminé anuncios', unit: 'anuncios' },
  { id: 'google.ad.updated', platform: 'google_ads', label: 'Actualicé anuncios', unit: 'anuncios' },
  { id: 'google.campaign.created', platform: 'google_ads', label: 'Creé campañas', unit: 'campañas' },
  { id: 'google.adgroup.created', platform: 'google_ads', label: 'Creé grupos de anuncios', unit: 'grupos' },
  { id: 'google.keyword.updated', platform: 'google_ads', label: 'Actualicé keywords', unit: 'keywords' },
  { id: 'google.keyword.negative_added', platform: 'google_ads', label: 'Añadí keywords negativas', unit: 'keywords' },
  { id: 'google.youtube.video_uploaded', platform: 'google_ads', label: 'Subí videos a YouTube', unit: 'videos' },
  { id: 'google.asset_group.updated', platform: 'google_ads', label: 'Actualicé grupos de recursos', unit: 'grupos' },
  { id: 'google.budget.updated', platform: 'google_ads', label: 'Ajusté presupuestos', unit: 'ajustes' },
  { id: 'google.bidding.updated', platform: 'google_ads', label: 'Actualicé pujas', unit: 'ajustes' },
] as const
export type ActionTypeId = typeof ACTION_TYPES[number]['id'] | `custom.${string}`
export type CustomAction = { id: `custom.${string}`; label: string; platform: AdPlatform; service?: WorkService; scope: 'general' | 'client'; clientId?: string }
export function validCustomAction(value: unknown): value is CustomAction {
  if (!value || typeof value !== 'object') return false
  const item = value as CustomAction
  return typeof item.id === 'string' && /^custom\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.id) && typeof item.label === 'string' && item.label === item.label.trim() && item.label.length >= 2 && item.label.length <= 80 && ['meta_ads', 'google_ads'].includes(item.platform) && (item.service === undefined || ['meta_ads','google_ads','meta_organic'].includes(item.service) && serviceProvider(item.service) === item.platform) && (item.scope === 'general' ? item.clientId === undefined : item.scope === 'client' && typeof item.clientId === 'string' && Boolean(item.clientId))
}
export const isScheduledAction = (id: string) => id === 'meta.story.scheduled' || id === 'meta.post.scheduled'
export const CREATED_WITH_END_DATE = new Set(['meta.ad.created', 'meta.adset.created', 'meta.campaign.created', 'google.ad.created', 'google.adgroup.created', 'google.campaign.created'])
/** Optional names for ads, scheduled stories and scheduled posts. */
export const ITEM_TITLED_ACTIONS = new Set(['meta.ad.created', 'google.ad.created', 'meta.story.scheduled', 'meta.post.scheduled'])
export const ITEM_TITLE_FIELD_MAX_LENGTH = 1000
export const ITEM_TITLE_SEGMENT_MAX_LENGTH = 80
export const ITEM_TITLE_MAX_COUNT = 40
export function itemTitleLabel(typeId: string): string {
  if (typeId === 'meta.story.scheduled') return 'Nombres de historias (opcional)'
  if (typeId === 'meta.post.scheduled') return 'Nombres de publicaciones (opcional)'
  return 'Nombres de anuncios (opcional)'
}
/** Split on commas, line breaks, or " - ". Hyphens inside a title stay put. */
export function parseItemTitles(raw: string): string[] | undefined {
  const titles = raw.split(/\s+-\s+|[,\r\n]+/).map(part => part.trim()).filter(Boolean)
  return titles.length ? titles : undefined
}
/** Keep at most `quantity` names. The field shows the cut; validation rejects a longer list. */
export function storyDayTitlesFromInput(raw: string, quantity: number): string[] | undefined {
  const titles = (parseItemTitles(raw) ?? []).slice(0, Math.max(0, quantity))
  return titles.length ? titles : undefined
}
export function itemTitlesToText(titles: readonly string[] | undefined): string {
  return titles?.join('\n') ?? ''
}
export function formatItemTitles(titles: readonly string[] | undefined): string {
  const items = titles?.map(title => title.trim()).filter(Boolean) ?? []
  return items.length ? ` · ${items.join(', ')}` : ''
}
export type StoryDayCount = { day: StoryDay; quantity: number; titles?: string[] }
function titledDay(part: StoryDayCount): StoryDayCount {
  const titles = part.titles?.map(title => title.trim()).filter(Boolean)
  return titles?.length ? { day: part.day, quantity: part.quantity, titles } : { day: part.day, quantity: part.quantity }
}
/** Flat names that the day fields did not take over. Matching lists retire once a day stores its own titles. */
export function storyItemTitlesAfterCounts(previous: readonly StoryDayCount[] | undefined, next: readonly StoryDayCount[], itemTitles?: readonly string[]): string[] | undefined {
  if (!next.some(part => part.titles?.length)) return itemTitles ? [...itemTitles] : undefined
  const hadExplicit = previous?.some(part => part.titles?.some(title => title.trim()))
  const fallbackPlaced = !hadExplicit && storyCountsWithTitles(previous ?? [], itemTitles).some(part => part.titles?.length)
  if (hadExplicit || fallbackPlaced) return undefined
  const shown = new Set(next.flatMap(part => part.titles ?? []))
  const unused = (itemTitles ?? []).map(title => title.trim()).filter(title => title && !shown.has(title))
  return unused.length ? unused : undefined
}
/** Per-day titles win. A flat list fills weekday order only when it has one name per historia. */
export function storyCountsWithTitles(counts: readonly StoryDayCount[], fallbackTitles?: readonly string[]): StoryDayCount[] {
  const ordered = STORY_DAYS.flatMap(day => {
    const found = counts.find(item => item.day === day.id)
    return found ? [titledDay(found)] : []
  })
  if (ordered.some(part => part.titles?.length)) return ordered
  const fallback = fallbackTitles?.map(title => title.trim()).filter(Boolean) ?? []
  const total = ordered.reduce((sum, part) => sum + part.quantity, 0)
  if (!fallback.length || fallback.length !== total) return ordered
  let index = 0
  return ordered.map(part => {
    const titles = fallback.slice(index, index + part.quantity)
    index += part.quantity
    return { day: part.day, quantity: part.quantity, titles }
  })
}
/** Day clauses in weekday order. Titles sit in parentheses on their day; « · » joins those clauses. */
export function formatStorySchedule(counts: readonly StoryDayCount[], fallbackTitles?: readonly string[]): { schedule: string; suffix: string } {
  const explicit = counts.some(part => part.titles?.some(title => title.trim()))
  const resolved = storyCountsWithTitles(counts, explicit ? undefined : fallbackTitles)
  const shown = new Set(resolved.flatMap(part => part.titles ?? []))
  const unused = (fallbackTitles ?? []).map(title => title.trim()).filter(title => title && !shown.has(title))
  if (!shown.size) return { schedule: formatDayQuantities(resolved), suffix: formatItemTitles(unused) }
  const parts = STORY_DAYS.flatMap(day => {
    const found = resolved.find(item => item.day === day.id)
    if (!found) return []
    const named = found.titles?.length ? ` (${found.titles.join(', ')})` : ''
    return [`${found.quantity} para ${day.label}${named}`]
  })
  return { schedule: parts.join(' · '), suffix: formatItemTitles(unused) }
}
export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
/** «3 para sábado y 2 para domingo». Weekday order, never an invented split. */
export function formatDayQuantities(counts: readonly StoryDayCount[]): string {
  const parts = STORY_DAYS.flatMap(day => {
    const found = counts.find(item => item.day === day.id)
    return found ? [`${found.quantity} para ${day.label}`] : []
  })
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}
export const availableCustomActions = (catalog: CustomAction[], clientId?: string) => catalog.filter(item => validCustomAction(item) && (item.scope === 'general' || item.clientId === clientId))
export type ReviewAction = {
  id: string
  typeId: ActionTypeId
  quantity: number
  source: 'manual' | 'companion'
  evidence: 'user_confirmed' | 'observed'
  sourceEventId?: string
  scheduledDays?: StoryDay[]
  /** Per-day quantities, with optional titles for that day. Absent on older records, which only know the combined total. */
  storyCounts?: StoryDayCount[]
  /** Optional last active day for a created ad, ad set or campaign. */
  endsOn?: string
  /** Optional titles for created ads, scheduled stories or posts. Count is independent of quantity. */
  itemTitles?: string[]
  /** Snapshot keeps historical reports readable independently of the catalog. */
  customDefinition?: CustomAction
}

export function actionDefinition(id: string) { return ACTION_TYPES.find(item => item.id === id) }
export function entryDefinition(entry: ReviewAction) { return actionDefinition(entry.typeId) ?? entry.customDefinition }
export const definitionService = (definition: { id: string; platform: AdPlatform; service?: WorkService }): WorkService => definition.service ?? (isScheduledAction(definition.id) ? 'meta_organic' : definition.platform)
export const entryService = (entry: ReviewAction): WorkService | undefined => { const definition = entryDefinition(entry); return definition ? definitionService(definition) : undefined }

export function validReviewActions(value: unknown): value is ReviewAction[] {
  if (!Array.isArray(value) || value.length > 40) return false
  const ids = new Set<string>()
  const types = new Set<string>()
  return value.every(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id) || types.has(item.typeId) || !(actionDefinition(item.typeId) ? item.customDefinition === undefined : validCustomAction(item.customDefinition) && item.customDefinition.id === item.typeId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !['manual', 'companion'].includes(item.source) || !['user_confirmed', 'observed'].includes(item.evidence)) return false
    if (item.source === 'manual' && item.evidence !== 'user_confirmed') return false
    if (item.source === 'companion' && (typeof item.sourceEventId !== 'string' || !item.sourceEventId)) return false
    if (isScheduledAction(item.typeId)) {
      if (!Array.isArray(item.scheduledDays) || !item.scheduledDays.length || item.scheduledDays.length > 7 || new Set(item.scheduledDays).size !== item.scheduledDays.length || item.scheduledDays.some((day: unknown) => !STORY_DAYS.some(option => option.id === day))) return false
    } else if (item.scheduledDays !== undefined) return false
    if (item.storyCounts !== undefined) {
      const counts: unknown[] = Array.isArray(item.storyCounts) ? item.storyCounts : []
      if (item.typeId !== 'meta.story.scheduled' || !Array.isArray(item.storyCounts) || counts.length !== item.scheduledDays?.length || counts.length > 7) return false
      const seen = new Set<string>()
      let titleCount = 0
      let titleLength = 0
      const quantities = counts.map(part => {
        if (!part || typeof part !== 'object') return 0
        const day = 'day' in part ? part.day : undefined
        const quantity = 'quantity' in part ? part.quantity : undefined
        const titles = 'titles' in part ? part.titles : undefined
        if (typeof day !== 'string' || typeof quantity !== 'number' || seen.has(day) || !item.scheduledDays!.includes(day as StoryDay) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return 0
        if (titles !== undefined) {
          if (!Array.isArray(titles) || !titles.length || titles.length > quantity) return 0
          const seenTitles = new Set<string>()
          for (const title of titles) {
            if (typeof title !== 'string' || title !== title.trim() || title.length < 1 || title.length > ITEM_TITLE_SEGMENT_MAX_LENGTH || seenTitles.has(title)) return 0
            seenTitles.add(title)
            titleCount += 1
            titleLength += title.length
          }
          if (titleCount > ITEM_TITLE_MAX_COUNT || titleLength > ITEM_TITLE_FIELD_MAX_LENGTH) return 0
        }
        seen.add(day)
        return quantity
      })
      if (seen.size !== counts.length || quantities.some(quantity => quantity < 1) || quantities.reduce((sum, quantity) => sum + quantity, 0) !== item.quantity) return false
    }
    if (item.endsOn !== undefined && (!CREATED_WITH_END_DATE.has(item.typeId) || typeof item.endsOn !== 'string' || !validCalendarDate(item.endsOn))) return false
    if (item.itemTitles !== undefined) {
      if (!ITEM_TITLED_ACTIONS.has(item.typeId) || !Array.isArray(item.itemTitles) || !item.itemTitles.length || item.itemTitles.length > ITEM_TITLE_MAX_COUNT) return false
      const titles = new Set<string>()
      let totalLength = 0
      if (!item.itemTitles.every((title: unknown) => {
        if (typeof title !== 'string' || title !== title.trim() || title.length < 1 || title.length > ITEM_TITLE_SEGMENT_MAX_LENGTH || titles.has(title)) return false
        titles.add(title)
        totalLength += title.length
        return totalLength <= ITEM_TITLE_FIELD_MAX_LENGTH
      })) return false
    }
    ids.add(item.id); types.add(item.typeId)
    return true
  })
}

export function describeReviewActions(review: { actions: string; actionEntries?: ReviewAction[] }) {
  const entries = validReviewActions(review.actionEntries) ? review.actionEntries : []
  const lines = entries.map(item => {
    const definition = entryDefinition(item)!
    const story = item.typeId === 'meta.story.scheduled' && item.storyCounts?.length ? formatStorySchedule(item.storyCounts, item.itemTitles) : undefined
    const scheduled = story ? `: ${story.schedule}` : isScheduledAction(item.typeId) ? `: ${item.quantity} · para ${STORY_DAYS.filter(day => item.scheduledDays?.includes(day.id)).map(day => day.label).join(', ')}` : `: ${item.quantity}`
    const until = item.endsOn ? `, hasta el ${item.endsOn.split('-').reverse().join('/')}` : ''
    const named = story ? story.suffix : formatItemTitles(item.itemTitles)
    return `${serviceLabel(definitionService(definition))} · ${definition.label}${scheduled}${named}${until}${item.evidence === 'observed' ? ' (por confirmar)' : ''}`
  })
  return [...lines, review.actions].filter(Boolean).join('\n')
}

export function storyDaysLabel(reviews: { actionEntries?: ReviewAction[] }[], short = true, typeId = 'meta.story.scheduled') {
  const entries = reviews.flatMap(review => (review.actionEntries ?? []).filter(entry => entry.typeId === typeId))
  const counted = entries.length > 0 && entries.every(entry => entry.storyCounts?.length)
  const totals = new Map<StoryDay, number>()
  for (const entry of entries) {
    if (counted) for (const part of entry.storyCounts ?? []) totals.set(part.day, (totals.get(part.day) ?? 0) + part.quantity)
    else for (const day of entry.scheduledDays ?? []) totals.set(day, 0)
  }
  return STORY_DAYS.filter(day => totals.has(day.id)).map(day => {
    const name = short ? day.short : day.label
    const quantity = totals.get(day.id) ?? 0
    return counted && quantity > 0 ? `${name} ${quantity}` : name
  }).join(' · ')
}
