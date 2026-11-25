import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTION_TYPES, actionDefinition, availableCustomActions, describeReviewActions, formatItemTitles, itemTitlesToText, parseItemTitles, storyCountsWithTitles, storyDayTitlesFromInput, storyDaysLabel, validCustomAction, validReviewActions } from '../src/review-actions.ts'

const manual = { id: 'event-1', typeId: 'meta.ad.created', quantity: 3, source: 'manual', evidence: 'user_confirmed' }

test('custom actions have stable IDs, explicit scope and self-contained historical labels', () => {
  const custom = { id:'custom.00000000-0000-4000-8000-000000000001', label:'Actualicé el catálogo', platform:'meta_ads', scope:'client', clientId:'c' }
  const general = { ...custom, id:'custom.00000000-0000-4000-8000-000000000002', scope:'general', clientId:undefined }
  assert.equal(validCustomAction(custom),true)
  assert.equal(validCustomAction({...general,clientId:'c'}),false)
  assert.equal(validCustomAction({...custom,id:'meta.ad.created'}),false)
  assert.equal(validCustomAction({...custom,label:'  '}),false)
  assert.deepEqual(availableCustomActions([custom,general],'other'),[general])
  assert.equal(availableCustomActions([custom,general],'c').length,2)
  const entry = {...manual,typeId:custom.id,customDefinition:custom}
  assert.equal(validReviewActions([entry]),true)
  assert.equal(validReviewActions([{...entry,customDefinition:undefined}]),false)
  assert.equal(validReviewActions([{...entry,typeId:general.id}]),false)
  assert.equal(validReviewActions([{...manual,customDefinition:custom}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[entry]}),/Meta Ads · Actualicé el catálogo: 3/)
})

test('scheduled publications have their own type and weekday summary', () => {
  const post = {...manual,typeId:'meta.post.scheduled',scheduledDays:['fri','wed']}
  assert.equal(validReviewActions([post]),true)
  assert.equal(validReviewActions([{...post,scheduledDays:[]}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[post]}),/Programé publicación: 3 · para miércoles, viernes/)
  assert.equal(storyDaysLabel([{actionEntries:[post]}],true,'meta.post.scheduled'),'Mié · Vie')
})

test('scheduled stories carry explicit unique weekdays and render in canonical order',()=>{
  const story={...manual,typeId:'meta.story.scheduled',scheduledDays:['thu','mon']}
  assert.equal(validReviewActions([story]),true)
  for(const scheduledDays of [undefined,[],['bad'],['mon','mon'],[1]]) assert.equal(validReviewActions([{...story,scheduledDays}]),false)
  assert.equal(validReviewActions([{...manual,scheduledDays:['mon']}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[story]}),/para lunes, jueves/)
  assert.equal(storyDaysLabel([{actionEntries:[story]}]),'Lun · Jue')
  const counted={...story,quantity:5,scheduledDays:['sat','sun'],storyCounts:[{day:'sat',quantity:3},{day:'sun',quantity:2}]}
  assert.equal(validReviewActions([counted]),true)
  assert.equal(validReviewActions([{...counted,quantity:4}]),false)
  assert.equal(validReviewActions([{...counted,storyCounts:[{day:'sat',quantity:5}]}]),false)
  assert.equal(validReviewActions([{...manual,storyCounts:counted.storyCounts}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[counted]}),/Programé historia: 3 para sábado y 2 para domingo/)
  assert.equal(storyDaysLabel([{actionEntries:[counted]}]),'Sáb 3 · Dom 2')
})

test('created ads, scheduled stories and posts can record optional titles', () => {
  const ad = { ...manual, quantity: 2, itemTitles: ['Promo invierno', 'Retargeting'] }
  assert.equal(validReviewActions([ad]), true)
  assert.equal(validReviewActions([{ ...ad, itemTitles: ['Promo', 'Promo'] }]), false)
  assert.equal(validReviewActions([{ ...ad, itemTitles: [...ad.itemTitles, 'Extra nombre'] }]), true, 'title count is not capped by quantity')
  assert.equal(validReviewActions([{ ...manual, typeId: 'google.keyword.updated', itemTitles: ['KW'] }]), false)
  const story = { ...manual, typeId: 'meta.story.scheduled', scheduledDays: ['fri'], itemTitles: ['Lanzamiento'] }
  assert.match(describeReviewActions({ actions: '', actionEntries: [story] }), /Lanzamiento/)
  const post = { ...manual, typeId: 'meta.post.scheduled', scheduledDays: ['mon'], quantity: 1, itemTitles: ['Oferta del mes'] }
  assert.match(describeReviewActions({ actions: '', actionEntries: [ad] }), /Promo invierno/)
  assert.match(describeReviewActions({ actions: '', actionEntries: [post] }), /Oferta del mes/)
})

test('item titles parse from commas, line breaks or " - " and keep hyphens inside a name', () => {
  assert.deepEqual(parseItemTitles('A, B\nC'), ['A', 'B', 'C'])
  assert.deepEqual(parseItemTitles('  Promo invierno ,  '), ['Promo invierno'])
  assert.equal(parseItemTitles('  \n  '), undefined)
  assert.deepEqual(parseItemTitles('A - B, C\nD'), ['A', 'B', 'C', 'D'])
  assert.deepEqual(parseItemTitles('2026-11-SiamoAperti-V1.0-IH - 2026-11-LaCasonaEstáAbierta-V1.0-IH'), ['2026-11-SiamoAperti-V1.0-IH', '2026-11-LaCasonaEstáAbierta-V1.0-IH'])
  assert.deepEqual(storyDayTitlesFromInput('Uno - Dos - Tres', 2), ['Uno', 'Dos'])
  assert.equal(itemTitlesToText(['Uno', 'Dos']), 'Uno\nDos')
  assert.match(formatItemTitles(['Promo invierno', 'Retargeting Q4']), /Promo invierno, Retargeting Q4/)
})

test('story titles belong to their weekday and a flat list is only a fallback', () => {
  const named = { ...manual, typeId: 'meta.story.scheduled', quantity: 4, scheduledDays: ['sat', 'mon'], storyCounts: [{ day: 'sat', quantity: 2, titles: ['2026-11-SiamoAperti-V1.0-IH', 'Otra'] }, { day: 'mon', quantity: 2, titles: ['Lunes A'] }] }
  assert.equal(validReviewActions([named]), true)
  assert.equal(validReviewActions([{ ...named, storyCounts: [{ day: 'sat', quantity: 2, titles: ['A', 'B', 'C'] }, { day: 'mon', quantity: 2 }] }]), false)
  assert.equal(validReviewActions([{ ...named, storyCounts: [{ day: 'sat', quantity: 2, titles: ['A', 'A'] }, { day: 'mon', quantity: 2 }] }]), false)
  assert.equal(validReviewActions([{ ...named, storyCounts: [{ day: 'mon', quantity: 2, titles: ['Misma'] }, { day: 'sat', quantity: 2, titles: ['Misma'] }] }]), true)
  assert.match(describeReviewActions({ actions: '', actionEntries: [named] }), /Programé historia: 2 para lunes \(Lunes A\) · 2 para sábado \(2026-11-SiamoAperti-V1\.0-IH, Otra\)/)
  assert.doesNotMatch(describeReviewActions({ actions: '', actionEntries: [named] }), /· Lunes A,/)
  const flat = { ...manual, typeId: 'meta.story.scheduled', quantity: 3, scheduledDays: ['mon', 'sat'], storyCounts: [{ day: 'sat', quantity: 2 }, { day: 'mon', quantity: 1 }], itemTitles: ['Lunes', 'Sáb A', 'Sáb B'] }
  assert.deepEqual(storyCountsWithTitles(flat.storyCounts, flat.itemTitles), [{ day: 'mon', quantity: 1, titles: ['Lunes'] }, { day: 'sat', quantity: 2, titles: ['Sáb A', 'Sáb B'] }])
  assert.match(describeReviewActions({ actions: '', actionEntries: [flat] }), /1 para lunes \(Lunes\) · 2 para sábado \(Sáb A, Sáb B\)/)
  const loose = { ...flat, itemTitles: ['Solo'] }
  assert.deepEqual(storyCountsWithTitles(loose.storyCounts, loose.itemTitles), [{ day: 'mon', quantity: 1 }, { day: 'sat', quantity: 2 }])
  assert.match(describeReviewActions({ actions: '', actionEntries: [loose] }), /1 para lunes y 2 para sábado · Solo/)
})

test('a created ad, ad set or campaign can record an optional end date', () => {
  const campaign={...manual,typeId:'meta.campaign.created',quantity:1,endsOn:'2026-12-24'}
  assert.equal(validReviewActions([campaign]),true)
  assert.equal(validReviewActions([{...campaign,endsOn:'2026-02-31'}]),false)
  assert.equal(validReviewActions([{...manual,typeId:'google.keyword.updated',endsOn:'2026-12-24'}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[campaign]}),/hasta el 24\/12\/2026/)
})

test('catalog IDs are unique and distinguish identical labels across platforms', () => {
  assert.equal(new Set(ACTION_TYPES.map(item => item.id)).size, ACTION_TYPES.length)
  assert.notEqual(actionDefinition('meta.ad.created').platform, actionDefinition('google.ad.created').platform)
})

test('new quantity contract rejects unknown, duplicate and invalid records', () => {
  assert.equal(validReviewActions([manual]), true)
  for (const quantity of [0, -1, 1.5, 1000, NaN, '3']) assert.equal(validReviewActions([{ ...manual, quantity }]), false)
  assert.equal(validReviewActions([{ ...manual, typeId: 'invented.action' }]), false)
  assert.equal(validReviewActions([manual, { ...manual, id: 'other' }]), false)
  assert.equal(validReviewActions([manual, { ...manual, typeId: 'google.ad.created' }]), false)
})

test('Companion proposals require provenance and remain unconfirmed in reports', () => {
  const proposal = { ...manual, source: 'companion', evidence: 'observed', sourceEventId: 'source-uuid' }
  assert.equal(validReviewActions([proposal]), true)
  assert.equal(validReviewActions([{ ...proposal, sourceEventId: undefined }]), false)
  assert.equal(validReviewActions([{ ...manual, evidence: 'observed' }]), false)
  assert.match(describeReviewActions({ actions: '', actionEntries: [proposal] }), /por confirmar/)
})

test('legacy reviews retain their text; structured Meta and Google counts print together', () => {
  assert.equal(describeReviewActions({ actions: 'Texto anterior' }), 'Texto anterior')
  const text = describeReviewActions({ actions: 'Detalle libre', actionEntries: [manual, { ...manual, id: 'google-1', typeId: 'google.keyword.updated', quantity: 12 }] })
  assert.match(text, /Meta Ads · Añadí anuncios: 3/)
  assert.match(text, /Google Ads · Actualicé keywords: 12/)
  assert.match(text, /Detalle libre/)
})
