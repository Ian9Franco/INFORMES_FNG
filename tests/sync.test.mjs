import test from 'node:test'
import assert from 'node:assert/strict'
import { SyncEngine } from '../src/sync/engine.ts'
import { changePriority, diffStore, monthBounds, rowsStore, samePayload, storeRecords } from '../src/sync/records.ts'

const row = (name = 'ALLEGRA', version = 1) => ({ kind: 'client', id: 'a', payload: { id: 'a', name, active: true }, version, deleted: false })
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value) } }

test('manual sync waits for in-flight writes, drains batches and sends nothing when unchanged',async()=>{
  let finish,calls=0
  const engine=new SyncEngine({write:changes=>{calls++;return new Promise(resolve=>{finish=()=>resolve(changes.map(change=>({...change,version:2})))})},readKeys:async()=>[]},storage(),'sync',()=>{})
  engine.hydrate([row()])
  const next=rowsStore([row()]);next.clients[0].active=false;engine.edit(next)
  const first=engine.flush(),all=engine.synchronize()
  await Promise.resolve();assert.equal(calls,1)
  finish();await first;await all
  assert.equal(engine.queued.size,0)
  await engine.synchronize();assert.equal(calls,1)
  engine.dispose()
})
test('manual sync never reports success when the transport fails',async()=>{
  const engine=new SyncEngine({write:async()=>{throw Error('Unavailable')},readKeys:async()=>[]},storage(),'sync',()=>{})
  engine.hydrate([row()]);const next=rowsStore([row()]);next.clients[0].active=false;engine.edit(next)
  await assert.rejects(engine.synchronize(),/Unavailable/)
  assert.equal(engine.queued.size,1);engine.dispose()
})

test('custom definitions round-trip as individual records and precede dependent reviews', () => {
  const before=rowsStore([row()])
  const definition={id:'custom.00000000-0000-4000-8000-000000000001',label:'Actualicé catálogo',platform:'meta_ads',scope:'client',clientId:'a'}
  const after={...before,customActions:[definition],reviews:[{id:'review',clientId:'a',date:'2026-10-15',actions:'',observations:'',createdAt:'2026-10-15T12:00:00Z',actionEntries:[]}]}
  const changes=diffStore(before,after,new Map(),new Map()).sort((a,b)=>changePriority(a)-changePriority(b))
  assert.deepEqual(changes.map(change=>change.kind),['action','review'])
  assert.deepEqual(rowsStore([...storeRecords(after).values()].map(record=>({...record,deleted:false,version:1}))).customActions,[definition])
  assert.equal(changePriority({...changes[0],kind:'client'}),0)
})

test('period bounds preserve December rollover and payload equality ignores JSON key order', () => {
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2027-01-01' })
  assert.throws(() => monthBounds('2026-00'))
  assert.equal(samePayload({ a: 1, b: [2] }, { b: [2], a: 1 }), true)
})

test('editing one client never deletes unloaded history or sends unchanged entities', () => {
  const before = rowsStore([row()]), after = { ...before, clients: [{ ...before.clients[0], name: 'ALLEGRA NUEVO' }] }
  const diff = diffStore(before, after, new Map([['client:a', row()]]), new Map())
  assert.equal(diff.length, 1)
  assert.equal(diff[0].kind, 'client')
  assert.equal(diff[0].expectedVersion, 1)
})

test('remote updates produce no write echo and queued changes survive a reload', async () => {
  let writes = 0, view
  const saved = storage()
  const engine = new SyncEngine({ write: async () => { writes++; return [] }, readKeys: async () => [] }, saved, 'user-a', next => view = next)
  engine.hydrate([row()]); engine.edit(view.store)
  await engine.flush()
  assert.equal(writes, 0)
  engine.edit({ ...view.store, clients: [{ ...view.store.clients[0], name: 'CAMBIO' }] })
  engine.dispose()
  const restored = new SyncEngine({ write: async () => [], readKeys: async () => [] }, saved, 'user-a', next => view = next)
  restored.hydrate([row()])
  assert.equal(view.store.clients[0].name, 'CAMBIO')
  assert.equal(view.state, 'pending')
  restored.dispose()
})

test('a conflicting edit is retained locally until the user explicitly resolves it', () => {
  let view
  const engine = new SyncEngine({ write: async () => [], readKeys: async () => [] }, storage(), 'user-a', next => view = next)
  engine.hydrate([row()])
  engine.edit({ ...view.store, clients: [{ ...view.store.clients[0], name: 'PC' }] })
  engine.receive([row('CELULAR', 2)])
  assert.equal(view.state, 'conflict')
  assert.equal(view.store.clients[0].name, 'PC')
  engine.resolve('client:a', false)
  assert.equal(view.store.clients[0].name, 'CELULAR')
  assert.equal(view.state, 'saved')
  engine.dispose()
})

test('Realtime echo during an in-flight save does not conflict with a newer local edit', async () => {
  let view, complete
  const engine = new SyncEngine({ write: async () => new Promise(resolve => complete = resolve), readKeys: async () => [] }, storage(), 'user-a', next => view = next)
  engine.hydrate([row()])
  engine.edit({ ...view.store, clients: [{ ...view.store.clients[0], name: 'PRIMERO' }] })
  const write = engine.flush()
  engine.edit({ ...view.store, clients: [{ ...view.store.clients[0], name: 'SEGUNDO' }] })
  engine.receive([row('PRIMERO', 2)])
  complete([row('PRIMERO', 2)])
  await write
  assert.equal(view.state, 'pending')
  assert.equal(view.store.clients[0].name, 'SEGUNDO')
  assert.equal(engine.queued.get('client:a').expectedVersion, 2)
  assert.equal(engine.conflicts.size, 0)
  engine.dispose()
})
