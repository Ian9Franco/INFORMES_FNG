import type { Review } from './data'
import { entryDefinition, isScheduledAction, STORY_DAYS, validReviewActions } from './review-actions.ts'

export type DetailItem = { id: string; date?: string; text: string; continued?: boolean }
export type DetailBlock = { id: string; title: string; items: DetailItem[]; continued?: boolean }
export type DetailPage = { columns: [DetailBlock[], DetailBlock[]] }

/** Keep all recorded information; only remove empty labels and repeated platform prefixes. */
export function compactReviewText(review: Review): string {
  const entries = validReviewActions(review.actionEntries) ? review.actionEntries : []
  const lines = (['meta_ads', 'google_ads'] as const).map(platform => {
    const actions = entries.filter(entry => entryDefinition(entry)?.platform === platform).map(entry => {
      const days = isScheduledAction(entry.typeId) ? ` (para ${STORY_DAYS.filter(day => entry.scheduledDays?.includes(day.id)).map(day => day.label).join(', ')})` : ''
      return `${entryDefinition(entry)!.label}: ${entry.quantity}${days}${entry.evidence === 'observed' ? ' (por confirmar)' : ''}`
    })
    return actions.length ? `${platform === 'meta_ads' ? 'Meta' : 'Google'} · ${actions.join('; ')}` : ''
  }).filter(Boolean)
  if (review.actions.trim()) lines.push(review.actions.trim())
  if (review.observations.trim()) lines.push(`Observaciones · ${review.observations.trim()}`)
  return lines.join('\n') || `${review.platform ? `${review.platform === 'meta_ads' ? 'Meta' : 'Google'} · ` : ''}Revisado sin cambios`
}

/** Measured physical pagination: never scale type or drop overflow. */
export function paginateDetail(blocks: DetailBlock[], capacity: number, gap: number, measure: (block: DetailBlock) => number): DetailPage[] {
  const columns: DetailBlock[][] = [[]]
  let used = 0
  const current = () => columns[columns.length - 1]
  const advance = () => { if (current().length) { columns.push([]); used = 0 } }
  const fits = (block: DetailBlock) => used + (current().length ? gap : 0) + measure(block) <= capacity + .1
  const put = (block: DetailBlock) => { used += (current().length ? gap : 0) + measure(block); current().push(block) }
  for (const block of blocks) {
    // Preserve an entire client whenever it fits a full column.
    if (measure(block) <= capacity + .1) { if (!fits(block)) advance(); put(block); continue }
    let chunk: DetailBlock = { ...block, items: [] }
    let started = false
    for (const item of block.items) {
      let remaining = Array.from(item.text), part = 0
      while (true) {
        const candidateItem = { ...item, id: part ? `${item.id}:part:${part}` : item.id, text: remaining.join(''), continued: Boolean(item.continued || part) }
        const candidate = { ...chunk, items: [...chunk.items, candidateItem] }
        if (fits(candidate)) { chunk = candidate; break }
        // Keep normal reviews intact. Only split a note longer than a whole column.
        if (measure({ ...chunk, items: [candidateItem] }) <= capacity + .1) {
          if (chunk.items.length) { put(chunk); started = true }
          advance()
          chunk = { ...block, continued: Boolean(block.continued || started), items: [] }
          continue
        }
        let low = 1, high = remaining.length, count = 0
        while (low <= high) {
          const mid = Math.floor((low + high) / 2)
          if (fits({ ...chunk, items: [...chunk.items, { ...candidateItem, text: remaining.slice(0, mid).join('') }] })) { count = mid; low = mid + 1 } else high = mid - 1
        }
        if (!count) {
          if (!chunk.items.length && !current().length) throw Error('El encabezado del informe no deja espacio para el texto.')
          if (chunk.items.length) { put(chunk); started = true }
          advance(); chunk = { ...block, continued: Boolean(block.continued || started), items: [] }
          continue
        }
        if (count < remaining.length) for (let index = count - 1; index > count / 2; index--) if (/\s/.test(remaining[index])) { count = index + 1; break }
        chunk.items.push({ ...candidateItem, id: `${item.id}:part:${part}`, text: remaining.slice(0, count).join('') })
        put(chunk); started = true; advance()
        chunk = { ...block, continued: true, items: [] }
        remaining = remaining.slice(count); part++
      }
    }
    if (chunk.items.length) put(chunk)
  }
  // Balance the final sheet using whole blocks; reading order stays top-to-bottom, left-to-right.
  const lastStart = Math.floor((columns.length - 1) / 2) * 2
  const last = columns.slice(lastStart).flat()
  if (last.length > 1) {
    const height = (items: DetailBlock[]) => items.reduce((sum, block) => sum + measure(block), 0) + Math.max(0, items.length - 1) * gap
    let best = -1, difference = Infinity
    for (let index = 1; index < last.length; index++) {
      const left = height(last.slice(0, index)), right = height(last.slice(index))
      if (left <= capacity && right <= capacity && Math.abs(left - right) < difference) { best = index; difference = Math.abs(left - right) }
    }
    if (best !== -1) columns.splice(lastStart, columns.length - lastStart, last.slice(0, best), last.slice(best))
  }
  return Array.from({ length: Math.ceil(columns.length / 2) }, (_, index) => ({ columns: [columns[index * 2], columns[index * 2 + 1] ?? []] }))
}
