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

const reviewRow=(id,notes='',version=1,service='meta_ads')=>({kind:'review',id,payload:{id,clientId:'a',date:'2026-10-14',platform:service==='google_ads'?'google_ads':'meta_ads',service,createdAt:'2026-10-14T12:00:00Z',actions:'',observations:notes,issues:[],actionEntries:[]},version,deleted:false})

test('a duplicate review UUID resolves to the canonical cloud ID/version, then stays resolved after reload',async()=>{
  let view,calls=0
  const saved=storage(),remote=reviewRow('cloud','Nube',4)
  const transport={write:async changes=>{
    calls++
    if(changes[0].id==='offline')throw Error('23505: duplicate key fng_review_day_unique')
    assert.equal(changes[0].id,'cloud');assert.equal(changes[0].payload.id,'cloud');assert.equal(changes[0].expectedVersion,4)
    return changes.map(change=>({...change,version:5}))
  },readKeys:async()=>[remote,reviewRow('organic','Historias',1,'meta_organic')]}
  const engine=new SyncEngine(transport,saved,'sync',next=>view=next)
  engine.hydrate([row()]);engine.edit({...view.store,reviews:[reviewRow('offline','Local').payload]})
  await engine.flush();assert.equal(calls,1);assert.equal(view.conflicts.length,1);assert.equal(view.rejected.length,0)
  engine.resolve('review:offline',true)
  assert.equal(engine.queued.has('review:offline'),false)
  assert.equal(engine.queued.get('review:cloud').payload.observations,'Local')
  await engine.synchronize();assert.equal(view.state,'saved');assert.equal(engine.conflicts.size,0)
  engine.receive([remote]);assert.equal(view.conflicts.length,0)
  engine.dispose()
  const restored=new SyncEngine(transport,saved,'sync',next=>view=next)
  restored.hydrate([row(),reviewRow('cloud','Local',5)])
  assert.equal(view.state,'saved');assert.equal(restored.queued.size,0);restored.dispose()
})

test('accepting cloud removes only that pending review, never writes or recreates its old UUID',async()=>{
  let view,calls=0
  const saved=storage(),remote=reviewRow('cloud','Nube',3)
  saved.setItem('sync',JSON.stringify([{kind:'review',id:'offline',payload:reviewRow('offline','Local').payload,expectedVersion:0,deleted:false}]))
  const transport={write:async()=>{calls++;return[]},readKeys:async()=>[]}
  const engine=new SyncEngine(transport,saved,'sync',next=>view=next)
  engine.hydrate([row(),remote]);assert.equal(view.conflicts.length,1)
  engine.resolve('review:offline',false);await engine.flush()
  assert.equal(calls,0);assert.equal(view.state,'saved');assert.equal(view.store.reviews[0].observations,'Nube')
  engine.receive([remote]);assert.equal(view.conflicts.length,0);engine.dispose()
  const restored=new SyncEngine(transport,saved,'sync',next=>view=next)
  restored.hydrate([remote]);assert.equal(view.state,'saved');assert.equal(restored.queued.size,0);restored.dispose()
})

test('database validation failures are not concurrent conflicts and are not retried blindly',async()=>{
  for(const code of ['P0001','23514','42501']) {
    let view,calls=0
    const engine=new SyncEngine({write:async()=>{calls++;throw Error(`${code}: datos inválidos`)},readKeys:async()=>[row()]},storage(),'sync',next=>view=next)
    engine.hydrate([row()]);engine.edit({...view.store,clients:[{...view.store.clients[0],active:false}]})
    await engine.flush();assert.equal(view.state,'rejected');assert.equal(view.conflicts.length,0);assert.equal(view.rejected.length,1)
    await engine.flush();assert.equal(calls,1)
    await assert.rejects(engine.synchronize(),/datos inválidos/)
    engine.resolve('client:a',false);assert.equal(view.state,'saved');assert.equal(engine.queued.size,0)
    engine.dispose()
  }
})

test('a delayed failed batch cannot resurrect a conflict already resolved in favor of the cloud',async()=>{
  let view,rejectWrite
  const engine=new SyncEngine({write:()=>new Promise((_,reject)=>rejectWrite=reject),readKeys:async()=>[row('NUBE',2)]},storage(),'sync',next=>view=next)
  engine.hydrate([row()]);engine.edit({...view.store,clients:[{...view.store.clients[0],name:'LOCAL'}]})
  const pending=engine.flush();engine.receive([row('NUBE',2)]);engine.resolve('client:a',false)
  rejectWrite(Error('40001: FNG_CONFLICT:client:a'));await pending
  assert.equal(view.state,'saved');assert.equal(view.conflicts.length,0);assert.equal(view.rejected.length,0);assert.equal(view.store.clients[0].name,'NUBE');engine.dispose()
})

test('a conflict response for an already-acknowledged write leaves no phantom conflicts',async()=>{
  let view
  const engine=new SyncEngine({write:async()=>{throw Error('40001: FNG_CONFLICT:client:a')},readKeys:async()=>[row('LOCAL',2)]},storage(),'sync',next=>view=next)
  engine.hydrate([row()]);engine.edit({...view.store,clients:[{...view.store.clients[0],name:'LOCAL'}]})
  await engine.flush();assert.equal(view.state,'saved');assert.equal(engine.conflicts.size,0);assert.equal(engine.rejected.size,0);engine.dispose()
})

test('duplicate detection stays within each service and respects atomic replacement tombstones',()=>{
  let view
  const saved=storage()
  saved.setItem('sync',JSON.stringify([{kind:'review',id:'local',payload:reviewRow('local').payload,expectedVersion:0,deleted:false}]))
  const engine=new SyncEngine({write:async()=>[],readKeys:async()=>[]},saved,'sync',next=>view=next)
  engine.hydrate([row(),reviewRow('google','',1,'google_ads'),reviewRow('organic','',1,'meta_organic')])
  assert.equal(engine.conflicts.size,0)
  engine.resolve('review:local',false)
  const old=reviewRow('old')
  engine.receive([old]);engine.edit({...view.store,reviews:[...view.store.reviews.filter(item=>item.id!=='old'),reviewRow('new').payload]})
  engine.receive([row('ALLEGRA',2)])
  assert.equal(engine.conflicts.size,0,'A planned logical delete is not a competing cloud review')
  engine.dispose()
})
