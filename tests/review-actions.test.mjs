import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTION_TYPES, actionDefinition, describeReviewActions, storyDaysLabel, validReviewActions } from '../src/review-actions.ts'

const manual = { id: 'event-1', typeId: 'meta.ad.created', quantity: 3, source: 'manual', evidence: 'user_confirmed' }

test('scheduled stories carry explicit unique weekdays and render in canonical order',()=>{
  const story={...manual,typeId:'meta.story.scheduled',scheduledDays:['thu','mon']}
  assert.equal(validReviewActions([story]),true)
  for(const scheduledDays of [undefined,[],['bad'],['mon','mon'],[1]]) assert.equal(validReviewActions([{...story,scheduledDays}]),false)
  assert.equal(validReviewActions([{...manual,scheduledDays:['mon']}]),false)
  assert.match(describeReviewActions({actions:'',actionEntries:[story]}),/para lunes, jueves/)
  assert.equal(storyDaysLabel([{actionEntries:[story]}]),'Lun · Jue')
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
  assert.match(text, /Meta · Añadí anuncios: 3/)
  assert.match(text, /Google · Actualicé keywords: 12/)
  assert.match(text, /Detalle libre/)
})
