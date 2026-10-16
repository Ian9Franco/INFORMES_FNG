import test from 'node:test'
import assert from 'node:assert/strict'
import { activePlatforms, platformActive, scopedReviews, togglePlatform } from '../src/platforms.ts'
import { activeReportStore } from '../src/report-export.ts'
import { draftKey } from '../src/review-workflow.ts'
const client={id:'c',name:'DOS PLATAFORMAS',active:true,services:['meta_ads','google_ads'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}]}
const meta={id:'m',typeId:'meta.ad.created',quantity:1,source:'manual',evidence:'user_confirmed'}
const google={id:'g',typeId:'google.keyword.updated',quantity:2,source:'manual',evidence:'user_confirmed'}
const legacy={id:'r',clientId:'c',date:'2026-10-15',createdAt:'2026-10-15T12:00:00Z',actions:'Nota previa',observations:'Observación',actionSchemaVersion:1,actionEntries:[meta,google],revision:7}
test('archive/reactivate is independent and preserves bindings; globally archived clients reactivate only the selected platform',()=>{
  const archived=togglePlatform(client,'meta_ads')
  assert.deepEqual(activePlatforms(archived),['google_ads'])
  assert.equal(archived.advertisingAccounts,client.advertisingAccounts)
  assert.deepEqual(activePlatforms(togglePlatform(archived,'meta_ads')),['meta_ads','google_ads'])
  assert.deepEqual(activePlatforms(togglePlatform({...client,active:false},'google_ads')),['google_ads'])
  assert.equal(platformActive(client,'google_ads'),true)
})
test('legacy mixed reviews project independent scopes, keep original notes once and never mutate history',()=>{
  const source=structuredClone(legacy), reviews=scopedReviews([legacy],[client])
  assert.equal(reviews.length,2)
  assert.deepEqual(reviews.map(r=>r.platform),['meta_ads','google_ads'])
  assert.deepEqual(reviews[0].actionEntries,[meta]);assert.deepEqual(reviews[1].actionEntries,[google])
  assert.equal(reviews[0].actions,'Nota previa');assert.equal(reviews[1].observations,'')
  assert.equal(reviews[0].revision,7);assert.equal(reviews[1].revision,undefined)
  assert.equal(new Set(reviews.map(r=>r.id)).size,2)
  assert.deepEqual(legacy,source)
  assert.deepEqual(scopedReviews(reviews,[client]),reviews,'Projection must be idempotent')
})
test('reports retain only Google when Meta is archived, including old mixed actions and platform-specific tasks',()=>{
  const store={clients:[togglePlatform(client,'meta_ads')],reviews:[legacy],pending:[{id:'pm',clientId:'c',platform:'meta_ads'},{id:'pg',clientId:'c',platform:'google_ads'},{id:'old',clientId:'c'}].map(task=>({...task,text:'Revisar presupuesto',resolved:false})),closed:[]}
  const report=activeReportStore(store)
  assert.equal(report.clients.length,1)
  assert.deepEqual(report.reviews.map(r=>r.platform),['google_ads'])
  assert.deepEqual(report.reviews[0].actionEntries,[google])
  assert.equal(report.reviews[0].actions,'')
  assert.deepEqual(report.pending.map(p=>p.id),['pg','old'])
  assert.deepEqual(activeReportStore({...store,clients:[togglePlatform(store.clients[0],'google_ads')]}).reviews,[])
})
test('same-client same-day drafts and reviews never leak across platforms',()=>{
  assert.notEqual(draftKey('c','2026-10-15','meta_ads'),draftKey('c','2026-10-15','google_ads'))
  const reviews=scopedReviews([{...legacy,platform:'meta_ads',actionEntries:[meta]}],[client])
  assert.equal(reviews.some(r=>r.platform==='google_ads'),false)
})
