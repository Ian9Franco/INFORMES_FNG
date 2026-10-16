import type { Activity, Store } from '../data'
import { sortClients } from '../clients.ts'

export type Kind = 'client' | 'action' | 'review' | 'task' | 'closure' | 'settings' | 'event' | 'subscription' | 'condition'
export type RecordRow = { user_id?: string; kind: Kind; id: string; payload: Record<string, unknown>; version: number; deleted: boolean; review_date?: string; updated_at?: string }
export type Change = { kind: Kind; id: string; payload: Record<string, unknown>; expectedVersion: number; deleted: boolean }
export const recordKey = (record: { kind: string; id: string }) => `${record.kind}:${record.id}`
export const changePriority = (change: Change) => change.kind === 'client' && !change.deleted || change.kind === 'closure' && change.deleted ? 0 : change.kind === 'action' || change.deleted && (change.kind === 'review' || change.kind === 'task') ? 1 : change.kind === 'client' ? 3 : change.kind === 'closure' ? 4 : change.kind === 'settings' ? 5 : 2
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value
export const samePayload = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export function storeRecords(store: Store): Map<string, { kind: Kind; id: string; payload: Record<string, unknown> }> {
  const records = new Map<string, { kind: Kind; id: string; payload: Record<string, unknown> }>()
  const add = (kind: Kind, id: string, payload: Record<string, unknown>) => records.set(recordKey({ kind, id }), { kind, id, payload })
  store.clients.forEach(client => add('client', client.id, { ...client }))
  store.customActions?.forEach(action => add('action', action.id, { ...action }))
  store.reviews.forEach(({ revision: _revision, ...review }) => add('review', review.id, { ...review }))
  store.pending.forEach(task => add('task', task.id, { ...task }))
  store.issueStates?.forEach(state => add('condition', state.id, { ...state }))
  store.closed.forEach(day => add('closure', day, { id: day }))
  store.activity?.forEach(event => add('event', event.id, { ...event }))
  add('settings', 'workspace', { accountCatalogVersion: store.accountCatalogVersion ?? 0 })
  return records
}

export function rowsStore(rows: Iterable<RecordRow>, pending: Iterable<Change> = []): Store {
  const records = new Map([...rows].map(row => [recordKey(row), row]))
  for (const change of pending) records.set(recordKey(change), { ...change, version: change.expectedVersion })
  const live = [...records.values()].filter(row => !row.deleted)
  return {
    clients: sortClients(live.filter(row => row.kind === 'client').map(row => row.payload as unknown as Store['clients'][number])),
    reviews: live.filter(row => row.kind === 'review').map(row => ({ ...row.payload, revision: row.version } as unknown as Store['reviews'][number])),
    pending: live.filter(row => row.kind === 'task').map(row => row.payload as unknown as Store['pending'][number]),
    issueStates: live.filter(row => row.kind === 'condition').map(row => row.payload as unknown as NonNullable<Store['issueStates']>[number]),
    closed: live.filter(row => row.kind === 'closure').map(row => row.id),
    accountCatalogVersion: Number(live.find(row => row.kind === 'settings' && row.id === 'workspace')?.payload.accountCatalogVersion ?? 0),
    activity: live.filter(row => row.kind === 'event').map(row => row.payload as unknown as Activity),
    customActions: live.filter(row => row.kind === 'action').map(row => row.payload as unknown as NonNullable<Store['customActions']>[number]),
  }
}

export function diffStore(before: Store, after: Store, rows: Map<string, RecordRow>, queued: Map<string, Change>): Change[] {
  const old = storeRecords(before), next = storeRecords(after)
  const changes: Change[] = []
  for (const [key, record] of next) {
    if (record.kind === 'condition') continue // Server-derived, never echoed or imported as a write.
    if (samePayload(old.get(key)?.payload, record.payload)) continue
    changes.push({ ...record, expectedVersion: queued.get(key)?.expectedVersion ?? rows.get(key)?.version ?? 0, deleted: false })
  }
  for (const [key, record] of old) if (record.kind !== 'condition' && !next.has(key)) changes.push({ ...record, expectedVersion: queued.get(key)?.expectedVersion ?? rows.get(key)?.version ?? 0, deleted: true })
  return changes
}

export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mes inválido')
  const [year, number] = month.split('-').map(Number)
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`
  return { start: `${month}-01`, end: `${next}-01` }
}
