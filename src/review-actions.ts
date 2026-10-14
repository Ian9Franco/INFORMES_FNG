/** Immutable integration keys. Labels may change; IDs must never be renamed/reused. */
export const ACTION_SCHEMA_VERSION = 1 as const
export type AdPlatform = 'meta_ads' | 'google_ads'
export const ACTION_TYPES = [
  { id: 'meta.ad.created', platform: 'meta_ads', label: 'Añadí anuncios', unit: 'anuncios' },
  { id: 'meta.ad.deleted', platform: 'meta_ads', label: 'Eliminé anuncios', unit: 'anuncios' },
  { id: 'meta.ad.updated', platform: 'meta_ads', label: 'Actualicé anuncios', unit: 'anuncios' },
  { id: 'meta.ad.paused', platform: 'meta_ads', label: 'Pausé anuncios', unit: 'anuncios' },
  { id: 'meta.campaign.created', platform: 'meta_ads', label: 'Creé campañas', unit: 'campañas' },
  { id: 'meta.adset.created', platform: 'meta_ads', label: 'Creé conjuntos', unit: 'conjuntos' },
  { id: 'meta.budget.updated', platform: 'meta_ads', label: 'Ajusté presupuestos', unit: 'ajustes' },
  { id: 'meta.audience.updated', platform: 'meta_ads', label: 'Actualicé audiencias', unit: 'audiencias' },
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
export type ActionTypeId = typeof ACTION_TYPES[number]['id']
export type ReviewAction = {
  id: string
  typeId: ActionTypeId
  quantity: number
  source: 'manual' | 'companion'
  evidence: 'user_confirmed' | 'observed'
  sourceEventId?: string
}

export function actionDefinition(id: string) { return ACTION_TYPES.find(item => item.id === id) }

export function validReviewActions(value: unknown): value is ReviewAction[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  const types = new Set<string>()
  return value.every(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id) || types.has(item.typeId) || !actionDefinition(item.typeId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !['manual', 'companion'].includes(item.source) || !['user_confirmed', 'observed'].includes(item.evidence)) return false
    if (item.source === 'manual' && item.evidence !== 'user_confirmed') return false
    if (item.source === 'companion' && (typeof item.sourceEventId !== 'string' || !item.sourceEventId)) return false
    ids.add(item.id); types.add(item.typeId)
    return true
  })
}

export function describeReviewActions(review: { actions: string; actionEntries?: ReviewAction[] }) {
  const entries = validReviewActions(review.actionEntries) ? review.actionEntries : []
  const lines = entries.map(item => {
    const definition = actionDefinition(item.typeId)!
    return `${definition.platform === 'meta_ads' ? 'Meta' : 'Google'} · ${definition.label}: ${item.quantity}${item.evidence === 'observed' ? ' (por confirmar)' : ''}`
  })
  return [...lines, review.actions].filter(Boolean).join('\n')
}
