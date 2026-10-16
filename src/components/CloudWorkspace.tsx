'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { date, keyDate, load, type Store } from '../data'
import { normalizeName } from '../account-catalog'
import { withManagedClients } from '../clients'
import { supabase } from '../lib/supabase'
import { SyncEngine, type SyncView } from '../sync/engine'
import { recordKey, rowsStore, storeRecords, type Change, type RecordRow } from '../sync/records'
import WorkspaceSkeleton from './WorkspaceSkeleton'
import WorkspaceControls from './WorkspaceControls'
import type { CustomAction } from '../review-actions'
import { definitionService } from '../review-actions'
import { reviewService } from '../work-services'
import { scopedReviews } from '../platforms'

const columns = 'kind,id,payload,version,deleted,review_date,updated_at'

export default function CloudWorkspace({ user, onPassword, onSignOut }: { user: User; onPassword: () => void; onSignOut: () => Promise<void> }) {
  const [view, setView] = useState<SyncView | null>(null)
  const [failure, setFailure] = useState('')
  const [loadingPeriod, setLoadingPeriod] = useState(false)
  const [online, setOnline] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ready, setReady] = useState(false)
  const [legacyImported, setLegacyImported] = useState(false)
  const legacyLocal = useRef(load())
  const engine = useRef<SyncEngine | null>(null)
  const range = useRef({ start: keyDate(new Date()).slice(0, 7) + '-01', end: keyDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)) })
  const loadedRanges = useRef(new Set<string>())
  const client = supabase!
  const userId = user.id

  const read = useCallback(async (kind: 'metadata' | 'period' | 'all', start?: string, end?: string) => {
    const rows: RecordRow[] = []
    for (let offset = 0; ; offset += 500) {
      let query = client.from('fng_records').select(columns).eq('user_id', userId).order('kind').order('id').range(offset, offset + 499)
      if (kind === 'metadata') query = query.neq('kind', 'review').neq('kind', 'event').neq('kind', 'subscription')
      if (kind === 'period') query = query.in('kind', ['review', 'event']).gte('review_date', start!).lt('review_date', end!)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      rows.push(...(data as RecordRow[]))
      if (data.length < 500) return rows
    }
  }, [client, userId])

  const fetchPeriod = useCallback(async (start: string, end: string, force = false) => {
    range.current = { start, end }
    const key = `${start}:${end}`
    if (!force && loadedRanges.current.has(key)) return
    setLoadingPeriod(true)
    try {
      const rows = await read('period', start, end)
      engine.current?.receive(rows)
      loadedRanges.current.add(key)
    } finally { setLoadingPeriod(false) }
  }, [read])

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => { /* Sync does not depend on Push support. */ })
    let alive = true
    let channel: ReturnType<typeof client.channel> | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const write = async (changes: Change[]) => {
      const { data, error } = await client.rpc('fng_apply_changes', { changes })
      if (error) throw new Error(`${error.code}: ${error.message}`)
      return data as RecordRow[]
    }
    const sync = new SyncEngine({ write, readKeys: async changes => {
      const keys = new Set(changes.map(recordKey))
      const { data, error } = await client.from('fng_records').select(columns).eq('user_id', userId).in('id', [...new Set(changes.map(change => change.id))])
      if (error) throw new Error(error.message)
      return (data as RecordRow[]).filter(row => keys.has(recordKey(row)))
    } }, localStorage, `fng-outbox:${userId}`, next => {
      if (!alive) return
      const { start, end } = range.current
      const cache = { ...next.store, reviews: next.store.reviews.filter(review => review.date >= start && review.date < end), activity: next.store.activity?.filter(event => event.date >= start && event.date < end) }
      try { localStorage.setItem(`fng-cache:${userId}`, JSON.stringify(cache)) } catch { localStorage.removeItem(`fng-cache:${userId}`) }
      setView(next)
    })
    engine.current = sync

    const refresh = async () => {
      if (!alive || document.visibilityState !== 'visible') return
      try {
        sync.receive(await read('metadata'))
        await fetchPeriod(range.current.start, range.current.end, true)
        setReady(true)
        setFailure('')
        await sync.flush()
      } catch (error) { if (alive) setFailure(error instanceof Error ? error.message : String(error)) }
    }
    const connect = () => {
      if (channel || document.visibilityState !== 'visible') return
      channel = client.channel(`workspace:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'fng_records', filter: `user_id=eq.${userId}` }, event => {
        const row = event.new as RecordRow
        if (!row.kind || row.kind === 'subscription') return
        // Carry tombstones and update only one record; no historical snapshot transfer.
        sync.receive([row])
      }).subscribe(status => {
        if (status === 'SUBSCRIBED') void refresh()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setFailure('La conexión en vivo se interrumpió. Al volver a la app se recuperarán los registros.')
      })
    }
    const resume = () => {
      setOnline(navigator.onLine)
      if (document.visibilityState === 'hidden') { if (channel) void client.removeChannel(channel); channel = null; return }
      connect()
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(), 300)
    }
    const start = async () => {
      try {
        const metadata = await read('metadata')
        if (!alive) return
        sync.hydrate([...metadata, ...await read('period', range.current.start, range.current.end)])
        loadedRanges.current.add(`${range.current.start}:${range.current.end}`)
        setReady(true)
        connect()
      } catch (error) {
        if (!alive) return
        const cached = localStorage.getItem(`fng-cache:${userId}`)
        if (cached) {
          const records = [...storeRecords(JSON.parse(cached) as Store).values()].map(row => ({ ...row, version: 0, deleted: false }))
          // Cached data is read-only until actual versions have been recovered.
          setView({ store: rowsStore(records), state: 'offline', conflicts: [], message: 'Sin conexión: mostrando la última copia de este usuario.' })
        }
        setFailure(error instanceof Error ? error.message : String(error))
      }
    }
    setOnline(navigator.onLine)
    const offline = () => setOnline(false)
    window.addEventListener('offline', offline)
    void start()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    window.addEventListener('focus', resume)
    return () => { window.removeEventListener('offline', offline); alive = false; sync.dispose(); engine.current = null; if (refreshTimer) clearTimeout(refreshTimer); if (channel) void client.removeChannel(channel); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('focus', resume) }
  }, [client, userId, read, fetchPeriod])

  const onChange = useCallback((store: Store) => engine.current?.edit(store), [])
  const changePeriod = useCallback((start: string, end: string) => { void fetchPeriod(start, end).catch(error => setFailure(String(error))) }, [fetchPeriod])
  const exportAll = useCallback(async () => rowsStore(await read('all'), engine.current?.queued.values()), [read])
  const importAll = useCallback(async (store: Store) => { const rows = await read('all'); engine.current?.receive(rows); engine.current?.edit(withManagedClients(rowsStore(rows), store)) }, [read])
  const mergeLegacy = useCallback(async () => {
    try {
      const rows = await read('all')
      engine.current?.receive(rows)
      const remote = rowsStore(rows, engine.current?.queued.values())
      const old = legacyLocal.current
      const mapping = new Map<string,string>()
      for (const client of old.clients) {
        const match = remote.clients.find(existing => existing.id === client.id || normalizeName(existing.name) === normalizeName(client.name) || existing.advertisingAccounts?.some(account => client.advertisingAccounts?.some(candidate => candidate.platform === account.platform && candidate.accountId === account.accountId)))
        if (match) mapping.set(client.id, match.id)
      }
      const actionMapping = new Map<string, CustomAction>()
      remote.customActions ??= []
      for (const definition of old.customActions ?? []) {
        const clientId = definition.scope === 'client' ? mapping.get(definition.clientId!) : undefined
        if (definition.scope === 'client' && !clientId) continue
        const remapped = { ...definition, ...(clientId ? { clientId } : {}) }
        const existing = remote.customActions.find(item => item.id === definition.id || definitionService(item) === definitionService(definition) && item.scope === definition.scope && item.clientId === clientId && item.label.toLocaleLowerCase() === definition.label.toLocaleLowerCase())
        if (!existing) remote.customActions.push(remapped)
        actionMapping.set(definition.id, existing ?? remapped)
      }
      for (const review of scopedReviews(old.reviews,old.clients)) {
        const clientId = mapping.get(review.clientId)
        const actionEntries = review.actionEntries?.map(entry => {
          const definition = actionMapping.get(entry.typeId)
          return definition ? { ...entry, typeId: definition.id, customDefinition: definition } : entry
        })
        if (clientId && !scopedReviews(remote.reviews,remote.clients).some(existing => existing.id === review.id || (existing.clientId === clientId && existing.date === review.date && reviewService(existing) === reviewService(review)))) remote.reviews.push({ ...review, clientId, ...(actionEntries ? { actionEntries } : {}) })
      }
      for (const task of old.pending) { const clientId = mapping.get(task.clientId); if (clientId && !remote.pending.some(existing => existing.id === task.id)) remote.pending.push({ ...task, clientId }) }
      remote.closed = [...new Set([...remote.closed, ...old.closed])]
      engine.current?.edit(remote)
      await engine.current?.flush()
      if (!engine.current?.queued.size) { setLegacyImported(true); localStorage.setItem(`fng-legacy-imported:${userId}`, 'true') }
    } catch (error) { setFailure(String(error)) }
  }, [read, userId])
  const refreshNow = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try { engine.current?.receive(await read('metadata')); await fetchPeriod(range.current.start, range.current.end, true); setReady(true); setFailure(''); await engine.current?.flush() }
    catch (error) { setFailure(String(error)) }
    finally { setRefreshing(false) }
  }, [refreshing, read, fetchPeriod])
  const syncNow = useCallback(async () => {
    if(!engine.current || !navigator.onLine) throw Error('Sin conexión. Los cambios pendientes se conservan en este dispositivo.')
    await engine.current.synchronize()
    engine.current.receive(await read('metadata'))
    await fetchPeriod(range.current.start,range.current.end,true)
    await engine.current.synchronize()
    setReady(true);setFailure('')
  },[read,fetchPeriod])
  if (!view) return failure ? <><header className="app-navigation screen"><div className="wordmark"><strong>Informes FNG</strong></div><div /><div className="navigation-tools"><WorkspaceControls email={user.email} state="error" failure={failure} loading={refreshing} onRefresh={() => location.reload()} onPassword={onPassword} onSignOut={onSignOut} /></div></header><main className="auth-shell"><div className="auth-card"><h1>No se pudo abrir la nube</h1><p role="alert">{failure}</p><button onClick={() => location.reload()}>Reintentar</button></div></main></> : <WorkspaceSkeleton />
  return <>

    {!legacyImported && !localStorage.getItem(`fng-legacy-imported:${userId}`) && (legacyLocal.current.reviews.length > 0 || legacyLocal.current.pending.length > 0) ? <section className="sync-conflicts screen"><p>Este dispositivo tiene registros anteriores. Podés unirlos a tu cuenta sin reemplazar las revisiones existentes en la nube.</p><button onClick={() => void mergeLegacy()} disabled={!ready}>Unir registros de este dispositivo</button></section> : null}
    {view.conflicts.length ? <section className="sync-conflicts screen" aria-label="Conflictos de sincronización">{view.conflicts.map(change => <div key={recordKey(change)}><p>Otro dispositivo cambió este registro: <strong>{String(change.payload.name ?? change.payload.date ?? change.payload.text ?? change.id)}</strong>. Tu versión permanece guardada.</p><button onClick={() => engine.current?.resolve(recordKey(change), false)}>Usar versión de la nube</button><button onClick={() => engine.current?.resolve(recordKey(change), true)}>Conservar mi versión</button></div>)}</section> : null}
    <App onSync={syncNow} readOnly={!ready} headerTools={<WorkspaceControls email={user.email} state={online ? view.state : 'offline'} failure={failure} message={view.message} loading={loadingPeriod || refreshing} onRefresh={() => void refreshNow()} onPassword={onPassword} onSignOut={onSignOut} />} initialData={view.store} onChange={ready ? onChange : undefined} storageMode="cloud" userId={userId} onPeriodChange={changePeriod} onExport={exportAll} onImport={importAll} />
  </>
}
