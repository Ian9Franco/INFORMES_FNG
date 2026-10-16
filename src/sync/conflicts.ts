import type { Change, RecordRow } from './records.ts'

/** Mirrors the review uniqueness constraint without merging different services. */
export function reviewIdentity(record: Pick<Change | RecordRow, 'kind' | 'payload'>): string | undefined {
  const { kind, payload } = record
  if (kind !== 'review' || typeof payload.clientId !== 'string' || typeof payload.date !== 'string') return undefined
  return JSON.stringify([payload.clientId, payload.date, payload.service ?? payload.platform ?? 'legacy'])
}

export function reviewCounterpart(change: Change, rows: Iterable<RecordRow>): RecordRow | undefined {
  if (change.deleted) return undefined
  const identity = reviewIdentity(change)
  return identity ? [...rows].find(row => !row.deleted && row.id !== change.id && reviewIdentity(row) === identity) : undefined
}
