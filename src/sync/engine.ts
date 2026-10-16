import type { Store } from '../data'
import { changePriority, diffStore, recordKey, rowsStore, samePayload, type Change, type RecordRow } from './records.ts'
import { reviewCounterpart } from './conflicts.ts'

export type SyncState = 'saved' | 'pending' | 'offline' | 'conflict' | 'rejected' | 'error'
export type SyncView = { store: Store; state: SyncState; conflicts: Change[]; rejected: Change[]; message: string }
export type Transport = { write: (changes: Change[]) => Promise<RecordRow[]>; readKeys: (changes: Change[]) => Promise<RecordRow[]> }

/** Durable per-user outbox, per-record CAS, and explicit conflict resolution. */
export class SyncEngine {
  rows = new Map<string, RecordRow>()
  queued = new Map<string, Change>()
  conflicts = new Set<string>()
  rejected = new Set<string>()
  private before: Store = { clients: [], reviews: [], pending: [], closed: [] }
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private inProgress: Promise<void> | null = null
  private inFlight = new Map<string, Change>()
  private disposed = false
  private retry = 1000
  private message = ''
  private status: SyncState = 'saved'
  constructor(private transport: Transport, private storage: Pick<Storage, 'getItem' | 'setItem'>, private key: string, private publish: (view: SyncView) => void) {
    const saved = storage.getItem(key)
    if (saved) {
      const entries = JSON.parse(saved) as Change[]
      for (const change of entries) this.queued.set(recordKey(change), change)
    }
  }
  hydrate(rows: RecordRow[]) { this.receive(rows); this.schedule() }
  private counterpart(change: Change) { return reviewCounterpart(change, [...this.rows.values()].filter(row => !this.queued.get(recordKey(row))?.deleted)) }
  receive(rows: RecordRow[]) {
    for (const row of rows) {
      const key = recordKey(row), known = this.rows.get(key)
      if (known && known.version >= row.version) continue
      this.rows.set(key, row)
    }
    // Also inspect already-known rows: a refetch can return the same version, and
    // two devices can create the same client/day/service with different UUIDs.
    for (const [key, pending] of this.queued) {
      const row = this.rows.get(key)
      if (row && row.version > pending.expectedVersion) {
        if (samePayload(pending.payload, row.payload) && pending.deleted === row.deleted) { this.queued.delete(key); this.conflicts.delete(key); this.rejected.delete(key) }
        else if (samePayload(this.inFlight.get(key)?.payload, row.payload) && this.inFlight.get(key)?.deleted === row.deleted) this.queued.set(key, { ...pending, expectedVersion: row.version })
        else this.conflicts.add(key)
      }
      if (this.queued.has(key) && this.counterpart(pending)) this.conflicts.add(key)
    }
    this.saveQueue()
    this.emit()
  }
  edit(store: Store) {
    for (const change of diffStore(this.before, store, this.rows, this.queued)) { const key = recordKey(change); this.queued.set(key, change); this.rejected.delete(key) }
    this.before = store
    this.message = ''
    this.saveQueue()
    this.emit()
    this.schedule()
  }
  private saveQueue() { this.storage.setItem(this.key, JSON.stringify([...this.queued.values()])) }
  private emit() {
    if (this.disposed) return
    for (const key of this.conflicts) if (!this.queued.has(key)) this.conflicts.delete(key)
    for (const key of this.rejected) if (!this.queued.has(key)) this.rejected.delete(key)
    this.before = rowsStore(this.rows.values(), this.queued.values())
    this.publish({ store: this.before, state: this.conflicts.size ? 'conflict' : this.rejected.size ? 'rejected' : this.queued.size ? this.status === 'offline' || this.status === 'error' ? this.status : 'pending' : 'saved', conflicts: [...this.conflicts].map(key => this.queued.get(key)!).filter(Boolean), rejected: [...this.rejected].map(key => this.queued.get(key)!).filter(Boolean), message: this.queued.size ? this.message : '' })
  }
  private schedule(delay = 350) {
    if (this.disposed || this.timer || ![...this.queued.keys()].some(key => !this.conflicts.has(key) && !this.rejected.has(key))) return
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush() }, delay)
  }
  async flush() {
    if(this.inProgress) return this.inProgress
    this.inProgress = this.flushBatch()
    try { await this.inProgress } finally { this.inProgress = null }
  }
  async synchronize() {
    for(let batch=0;batch<100;batch++) {
      await this.flush()
      if(this.conflicts.size) throw Error('Hay conflictos por resolver antes de sincronizar todo.')
      if(this.rejected.size) throw Error(this.message || 'Hay cambios que la DB rechazó. Revisalos desde Mi cuenta.')
      if(!this.queued.size) return
      if(this.status==='offline'||this.status==='error') throw Error(this.message || 'No se pudo conectar. Los pendientes siguen guardados en este dispositivo.')
    }
    throw Error('Todavía hay cambios pendientes. Volvé a sincronizar para continuar.')
  }
  private async flushBatch() {
    if (this.running || this.disposed) return
    const changes = [...this.queued].filter(([key]) => !this.conflicts.has(key) && !this.rejected.has(key)).map(([, change]) => change).sort((a,b) => changePriority(a)-changePriority(b)).slice(0, 150)
    if (!changes.length) return
    this.running = true
    this.inFlight = new Map(changes.map(change => [recordKey(change), change]))
    try {
      const rows = await this.transport.write(changes)
      // A newer local edit may have happened while this batch was in flight.
      for (const row of rows) {
        const key = recordKey(row), sent = changes.find(change => recordKey(change) === key), pending = this.queued.get(key)
        if (pending && sent && !samePayload(pending, sent)) this.queued.set(key, { ...pending, expectedVersion: row.version })
        else if (pending) { this.queued.delete(key); this.conflicts.delete(key); this.rejected.delete(key) }
      }
      this.status = 'saved'; this.retry = 1000; this.message = ''
      this.receive(rows)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/FNG_CONFLICT|23505|P0001|23514|42501|23503|22P02/.test(text)) {
        try { this.receive(await this.transport.readKeys(changes)) } catch { /* Keep the durable outbox; never claim the save succeeded. */ }
        const exact = text.match(/FNG_CONFLICT:([^:]+):([^\s]+)/)
        const conflictingKey = exact ? `${exact[1]}:${exact[2]}` : undefined
        if (conflictingKey && this.queued.has(conflictingKey)) this.conflicts.add(conflictingKey)
        // Validation failures are not evidence of a concurrent edit. Block only
        // this failed atomic batch, rather than retrying it forever or inventing
        // a separate conflict for every record in the batch.
        const unresolved = changes.filter(change => this.queued.has(recordKey(change)))
        if (!unresolved.some(change => this.conflicts.has(recordKey(change)))) {
          unresolved.forEach(change => this.rejected.add(recordKey(change)))
          this.message = unresolved.length ? `La DB no aceptó estos cambios. Siguen guardados en este dispositivo. ${text}` : ''
        } else this.message = 'Hay versiones distintas. Revisá los cambios desde Mi cuenta.'
      } else {
        this.status = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error'
        this.message = `Cambios guardados en este dispositivo; falta enviarlos. ${text}`
        this.retry = Math.min(this.retry * 2, 60000)
      }
      this.emit()
    } finally { this.running = false; this.inFlight.clear(); this.schedule(this.retry) }
  }
  resolve(key: string, keepLocal: boolean) {
    const pending = this.queued.get(key)
    if (!pending) return
    const target = this.rows.get(key) ?? this.counterpart(pending)
    if (keepLocal && target && recordKey(target) !== key && this.queued.has(recordKey(target))) throw Error('Hay otra edición local de esta revisión. Resolvé esa copia antes de conservar ésta.')
    this.queued.delete(key)
    if (keepLocal) {
      const change = { ...pending, id: target?.id ?? pending.id, payload: target ? { ...pending.payload, id: target.id, ...(typeof target.payload.createdAt === 'string' ? { createdAt: target.payload.createdAt } : {}) } : pending.payload, expectedVersion: target?.version ?? 0 }
      this.queued.set(recordKey(change), change)
    }
    this.conflicts.delete(key); this.rejected.delete(key); this.message = ''; this.status = 'saved'; this.saveQueue(); this.emit(); this.schedule()
  }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.saveQueue() }
}
