import type { Store } from '../data'
import { changePriority, diffStore, recordKey, rowsStore, samePayload, type Change, type RecordRow } from './records.ts'

export type SyncState = 'saved' | 'pending' | 'offline' | 'conflict' | 'error'
export type SyncView = { store: Store; state: SyncState; conflicts: Change[]; message: string }
export type Transport = { write: (changes: Change[]) => Promise<RecordRow[]>; readKeys: (changes: Change[]) => Promise<RecordRow[]> }

/** Durable per-user outbox, per-record CAS, and explicit conflict resolution. */
export class SyncEngine {
  rows = new Map<string, RecordRow>()
  queued = new Map<string, Change>()
  conflicts = new Set<string>()
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
  receive(rows: RecordRow[]) {
    for (const row of rows) {
      const key = recordKey(row), known = this.rows.get(key)
      if (known && known.version >= row.version) continue
      this.rows.set(key, row)
      const pending = this.queued.get(key)
      if (pending && row.version > pending.expectedVersion) {
        if (samePayload(pending.payload, row.payload) && pending.deleted === row.deleted) { this.queued.delete(key); this.conflicts.delete(key) }
        else if (samePayload(this.inFlight.get(key)?.payload, row.payload) && this.inFlight.get(key)?.deleted === row.deleted) this.queued.set(key, { ...pending, expectedVersion: row.version })
        else this.conflicts.add(key)
      }
    }
    this.saveQueue()
    this.emit()
  }
  edit(store: Store) {
    for (const change of diffStore(this.before, store, this.rows, this.queued)) this.queued.set(recordKey(change), change)
    this.before = store
    this.message = ''
    this.saveQueue()
    this.emit()
    this.schedule()
  }
  private saveQueue() { this.storage.setItem(this.key, JSON.stringify([...this.queued.values()])) }
  private emit() {
    if (this.disposed) return
    this.before = rowsStore(this.rows.values(), this.queued.values())
    this.publish({ store: this.before, state: this.conflicts.size ? 'conflict' : this.queued.size ? this.status === 'offline' || this.status === 'error' ? this.status : 'pending' : 'saved', conflicts: [...this.conflicts].map(key => this.queued.get(key)!).filter(Boolean), message: this.message })
  }
  private schedule(delay = 350) {
    if (this.disposed || this.timer || !this.queued.size) return
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
      if(!this.queued.size) return
      if(this.status==='offline'||this.status==='error') throw Error(this.message || 'No se pudo conectar. Los pendientes siguen guardados en este dispositivo.')
    }
    throw Error('Todavía hay cambios pendientes. Volvé a sincronizar para continuar.')
  }
  private async flushBatch() {
    if (this.running || this.disposed) return
    const changes = [...this.queued].filter(([key]) => !this.conflicts.has(key)).map(([, change]) => change).sort((a,b) => changePriority(a)-changePriority(b)).slice(0, 150)
    if (!changes.length) return
    this.running = true
    this.inFlight = new Map(changes.map(change => [recordKey(change), change]))
    try {
      const rows = await this.transport.write(changes)
      // A newer local edit may have happened while this batch was in flight.
      for (const row of rows) {
        const key = recordKey(row), sent = changes.find(change => recordKey(change) === key), pending = this.queued.get(key)
        if (pending && sent && !samePayload(pending, sent)) this.queued.set(key, { ...pending, expectedVersion: row.version })
        else if (pending) this.queued.delete(key)
      }
      this.status = 'saved'; this.retry = 1000; this.message = ''
      this.receive(rows)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (text.includes('FNG_CONFLICT') || text.includes('23505') || text.includes('P0001') || text.includes('23514')) {
        try { this.receive(await this.transport.readKeys(changes)) } catch { /* Retry on reconnect. */ }
        // A duplicate review date/account may use a different record ID.
        if (!this.conflicts.size) changes.forEach(change => this.conflicts.add(recordKey(change)))
        this.message = 'Hay cambios concurrentes. Elegí qué versión conservar.'
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
    if (keepLocal) this.queued.set(key, { ...pending, expectedVersion: this.rows.get(key)?.version ?? 0 })
    else this.queued.delete(key)
    this.conflicts.delete(key); this.message = ''; this.saveQueue(); this.emit(); this.schedule()
  }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer); this.saveQueue() }
}
