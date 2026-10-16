import test from 'node:test'
import assert from 'node:assert/strict'
import { activePlatforms, platformActive, scopedReviews, togglePlatform } from '../src/platforms.ts'
import { latestIssues, validReviewIssues, issueCellText, reviewConditionTone, conditionMark } from '../src/review-issues.ts'
import { simpleActionSummary, simpleActionLegend } from '../src/simple-report.ts'
import { compactReviewText } from '../src/report-layout.ts'
import { dailyRequired, weeklyServiceProgress } from '../src/service-cadence.ts'
import { activeReportStore } from '../src/report-export.ts'
import { readDrafts, draftChanged } from '../src/review-workflow.ts'
import { diffStore, storeRecords, rowsStore } from '../src/sync/records.ts'

const action=(typeId,quantity=1,extra={})=>({id:typeId,typeId,quantity,source:'manual',evidence:'user_confirmed',...extra})
const review=(service,extra={})=>({id:service,clientId:'c',platform:service==='google_ads'?'google_ads':'meta_ads',service,date:'2026-10-16',createdAt:'2026-10-16T12:00:00Z',actions:'',observations:'',actionEntries:[],...extra})
const client={id:'c',name:'PRUEBA',active:true,services:['meta_ads','google_ads','meta_organic']}

test('services are distinct from account access; organic needs no fabricated advertising ID',()=>{
  const organicGoogle={...client,services:['google_ads','meta_organic'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}]}
  assert.deepEqual(activePlatforms(organicGoogle),['google_ads','meta_organic'])
  assert.equal(platformActive(organicGoogle,'meta_ads'),false)
  assert.deepEqual(activePlatforms({id:'o',name:'ORGÁNICO',active:true,services:['meta_organic']}),['meta_organic'])
  const archived=togglePlatform(client,'meta_ads')
  assert.deepEqual(activePlatforms(archived),['google_ads','meta_organic'])
  assert.deepEqual(activePlatforms(togglePlatform(archived,'meta_organic')),['google_ads'])
})

test('old Meta history splits Ads and organic once, without losing notes, IDs, versions or modifying source',()=>{
  const old={...review('meta_ads',{actionEntries:[action('meta.ad.created'),action('meta.story.scheduled',2,{scheduledDays:['sat','sun']})],actions:'Nota',revision:7})};delete old.service
  const original=structuredClone(old),projected=scopedReviews([old],[client])
  assert.deepEqual(projected.map(r=>r.service),['meta_ads','meta_organic'])
  assert.equal(projected[0].id,old.id);assert.equal(projected[0].revision,7)
  assert.equal(projected[1].revision,undefined)
  assert.equal(projected.filter(r=>r.actions==='Nota').length,1)
  assert.deepEqual(scopedReviews(projected,[client]),projected)
  assert.deepEqual(old,original)
  const report=activeReportStore({clients:[togglePlatform(client,'meta_ads')],reviews:[old],pending:[],closed:[]})
  assert.deepEqual(report.reviews.map(r=>r.service),['meta_organic'])
  assert.equal(report.reviews[0].actionEntries[0].typeId,'meta.story.scheduled')
})

test('legacy drafts split by service; issue edits are durable drafts, not confirmed reviews',()=>{
  const draft={clientId:'c',day:'2026-10-16',platform:'meta_ads',actions:'Nota única',observations:'',pendingText:'',updatedAt:'2026-10-16',actionEntries:[action('meta.ad.created'),action('meta.post.scheduled',1,{scheduledDays:['sat']})]}
  const drafts=readDrafts({getItem:()=>JSON.stringify({'c:2026-10-16:meta_ads':draft})},'unused')
  assert.deepEqual(Object.keys(drafts),['c:2026-10-16:meta_ads','c:2026-10-16:meta_organic'])
  assert.equal(drafts['c:2026-10-16:meta_organic'].actions,'')
  assert.equal(draftChanged({...draft,actions:'',actionEntries:[],issues:[{type:'no_budget'}]}),true)
})

test('issues validate, carry across month/browser boundaries and explicit clearing keeps history unchanged',()=>{
  for(const bad of [null,[{type:'unknown'}],[{type:'error'},{type:'error'}],[{type:'error',detail:1}],[{type:'error',detail:'x'.repeat(601)}]])assert.equal(validReviewIssues(bad),false)
  const issues=[{type:'no_budget',detail:'Esperando recarga'}]
  const states=[{id:'status',clientId:'c',service:'meta_ads',date:'2026-09-30',reviewId:'old',issues}]
  assert.deepEqual(latestIssues([],'c','meta_ads','2026-10-01',states),issues)
  assert.deepEqual(latestIssues([],'c','google_ads','2026-10-01',states),[])
  assert.deepEqual(latestIssues([review('meta_ads',{date:'2026-10-02'})],'c','meta_ads','2026-10-03',states),issues,'An older app omitting issues does not explicitly resolve them')
  const cleared=review('meta_ads',{date:'2026-10-02',issues:[]})
  assert.deepEqual(latestIssues([cleared],'c','meta_ads','2026-10-03',states),[])
  const old=review('meta_ads',{issues})
  assert.match(compactReviewText(old),/Revisado con incidencia: Sin presupuesto: Esperando recarga/)
  assert.doesNotMatch(compactReviewText(old),/sin cambios/)
  assert.match(issueCellText([old]),/Meta Ads: Sin presupuesto/)
  assert.equal(old.issues,issues)
})

test('daily obligations are only weekday Meta Ads; flexible Google and organic track weekly work, not fixed dates',()=>{
  assert.equal(dailyRequired('meta_ads','2026-10-16'),true)
  assert.equal(dailyRequired('meta_ads','2026-10-17'),false)
  assert.equal(dailyRequired('google_ads','2026-10-16'),false)
  assert.equal(dailyRequired('meta_organic','2026-10-16'),false)
  const google=[review('google_ads',{id:'g1',date:'2026-10-12'}),review('google_ads',{id:'g2',date:'2026-10-15'})]
  assert.equal(weeklyServiceProgress(google,'c','google_ads','2026-10-16').days,2)
  assert.equal(weeklyServiceProgress([review('meta_organic')],'c','meta_organic','2026-10-16').programmed,false,'Reviewing is not the same as programming weekend content')
  assert.equal(weeklyServiceProgress([review('meta_organic',{actionEntries:[action('meta.story.scheduled',1,{scheduledDays:['sat']})]})],'c','meta_organic','2026-10-16').programmed,true)
})

test('simple report aggregates all actions with quantities, scopes, schedules, custom labels and a matching legend',()=>{
  const entries=[review('meta_ads',{actionEntries:[action('meta.ad.created',2),action('meta.campaign.created')]}),review('google_ads',{actionEntries:[action('google.keyword.updated',3),action('google.budget.updated')]}),review('meta_organic',{actionEntries:[action('meta.post.scheduled',2,{scheduledDays:['sat','sun']})]})]
  const text=simpleActionSummary(entries).join('\n'),legend=simpleActionLegend(entries)
  assert.match(text,/MA · An\+ ×2 · Camp ×1/)
  assert.match(text,/G · KW ×3 · Pres ×1/)
  assert.match(text,/MO · 2 publicaciones programadas para sábado, domingo \(registro 16\/10\/2026\)/)
  assert.match(legend,/An\+: Añadí anuncios/);assert.match(legend,/KW: Actualicé keywords/)
  assert.match(legend,/MA: Meta Ads · G: Google Ads · MO: Meta orgánico/)
  assert.doesNotMatch(legend,/Feed:/,'Scheduled content is spelled out rather than abbreviated')
  assert.match(legend,/An\+2 = 2 anuncios añadidos/)
  assert.match(legend,/\(Sáb\/Dom\) = días programados/)
  assert.equal(legend.includes('H: Programé historia'),false,'Only action abbreviations used in this period belong in the compact dictionary')
  assert.equal(legend.match(/Pres:/g).length,1)
  assert.deepEqual(simpleActionSummary([review('meta_ads',{issues:[{type:'no_budget'}]})]),[],'An issue is not a positive action or a quantity')
})

test('client-requested campaign pause is neutral, persistent and independent of errors and archiving',()=>{
  const issues=[{type:'client_paused',detail:'Hasta nuevo aviso'}]
  const paused=review('meta_ads',{issues})
  assert.equal(validReviewIssues(issues),true)
  assert.equal(reviewConditionTone(paused),'paused')
  assert.equal(conditionMark([paused]),'P')
  assert.equal(conditionMark([paused,review('google_ads',{issues:[{type:'error'}]})]),'!','An actual error must remain visible alongside a neutral pause')
  assert.match(compactReviewText(paused),/Meta Ads · Revisado · Campañas apagadas por decisión del cliente: Hasta nuevo aviso/)
  assert.doesNotMatch(compactReviewText(paused),/incidencia|error/i)
  assert.match(issueCellText([paused]),/decisión del cliente/)
  assert.match(simpleActionLegend([paused]),/P: campañas apagadas por decisión del cliente/)
  assert.deepEqual(simpleActionSummary([paused]),[],'A client pause is not work performed or a quantity')
  const states=[{id:'status',clientId:'c',service:'meta_ads',date:'2026-09-30',reviewId:'old',issues}]
  assert.deepEqual(latestIssues([],'c','meta_ads','2026-10-01',states),issues)
  assert.deepEqual(latestIssues([],'c','google_ads','2026-10-01',states),[])
  assert.deepEqual(latestIssues([review('meta_ads',{date:'2026-10-02',issues:[]})],'c','meta_ads','2026-10-03',states),[])
  const report=activeReportStore({clients:[client],reviews:[paused],pending:[],closed:[]})
  assert.equal(report.clients.length,1);assert.equal(report.reviews.length,1)
})

test('programming is readable, keeps every registration date and never claims publication occurred',()=>{
  const reviews=[review('meta_organic',{date:'2026-10-09',actionEntries:[action('meta.story.scheduled',2,{scheduledDays:['sun','sat']})]}),review('meta_organic',{date:'2026-10-16',actionEntries:[action('meta.story.scheduled',1,{scheduledDays:['wed']})]})]
  const summary=simpleActionSummary(reviews,true).join('\n')
  assert.match(summary,/2 historias programadas para sábado, domingo \(registro 09\/10\/2026\)/)
  assert.match(summary,/1 historia programada para miércoles \(registro 16\/10\/2026\)/)
  assert.doesNotMatch(summary,/publicad[ao]s?/)
  assert.match(simpleActionLegend(reviews),/Programado ≠ publicado/)
  assert.match(compactReviewText(reviews[0]),/Programé historia: 2 \(para sábado, domingo\)/)
})

test('the header legend explains review states even with no structured actions',()=>{
  for(const reviews of [[],[review('meta_ads',{issues:[{type:'no_budget'}]})]]) {
    const legend=simpleActionLegend(reviews)
    assert.match(legend,/✓: revisado/)
    assert.match(legend,/!: con incidencia/)
    assert.match(legend,/\?: por confirmar/)
    assert.doesNotMatch(legend,/KW:|Feed:|An\+:/)
  }
})

test('current condition metadata survives cache but is never uploaded, deleted or echoed by the client',()=>{
  const state={id:'status',clientId:'c',service:'meta_ads',date:'2026-10-16',reviewId:'r',issues:[{type:'error'}]}
  const data={clients:[client],reviews:[],pending:[],closed:[],issueStates:[state]}
  const records=[...storeRecords(data).values()].map(row=>({...row,version:1,deleted:false}))
  assert.deepEqual(rowsStore(records).issueStates,[state])
  assert.deepEqual(diffStore(data,{...data,issueStates:[]},new Map(),new Map()),[])
  assert.deepEqual(diffStore(data,{...data,issueStates:[{...state,issues:[]}]},new Map(),new Map()),[])
})
