import test from 'node:test'
import assert from 'node:assert/strict'
import { formatAccountId } from '../src/account-catalog.ts'
import { sortClients, withManagedClients } from '../src/clients.ts'
import { initial } from '../src/data.ts'
import { readdir, readFile } from 'node:fs/promises'

test('new workspaces never ship or regenerate a private customer catalog',()=>{
  assert.deepEqual(initial(),{clients:[],reviews:[],pending:[],closed:[]})
})
test('frontend source cannot contain hardcoded numeric account/context IDs',async()=>{
  for(const file of await readdir(new URL('../src/',import.meta.url),{recursive:true})) {
    if(!/\.(?:ts|tsx)$/.test(file))continue
    const source=await readFile(new URL(`../src/${file.replaceAll('\\','/')}`,import.meta.url),'utf8')
    assert.doesNotMatch(source,/["'`]\d{8,}["'`]/,file)
  }
})
test('Google IDs have display-only hyphens and large Meta IDs remain strings',()=>{
  assert.equal(formatAccountId({platform:'google_ads',accountId:'9000000001'}),'900-000-0001')
  assert.equal(formatAccountId({platform:'meta_ads',accountId:'90000000000000001'}),'90000000000000001')
})
test('clients are sorted alphabetically without mutating their source',()=>{
  const clients=[{id:'z',name:'ZETA'},{id:'a',name:'ÁLAMO'}]
  assert.deepEqual(sortClients(clients).map(c=>c.id),['a','z'])
  assert.equal(clients[0].id,'z')
})
test('backups cannot add, remove, rename or rebind managed clients',()=>{
  const current={clients:[{id:'a',name:'Privado',active:false,advertisingAccounts:[{platform:'google_ads',accountId:'9000000001',owner:''}]}],reviews:[],pending:[],closed:[]}
  const restored=withManagedClients(current,{clients:[{id:'attacker',name:'Otro',active:true}],reviews:[{id:'r',clientId:'a'}],pending:[],closed:[]})
  assert.equal(restored.clients,current.clients)
  assert.equal(restored.reviews.length,1)
  assert.throws(()=>withManagedClients(current,{clients:[],reviews:[{id:'r',clientId:'missing'}],pending:[],closed:[]}),/inexistentes/)
})
