import test from 'node:test'
import assert from 'node:assert/strict'
import { openPendingTasks, visiblePendingTasks } from '../src/pending-tasks.ts'
import { activeReportStore } from '../src/report-export.ts'
import { togglePlatform } from '../src/platforms.ts'

const client = { id:'c', name:'CUENTA DE PRUEBA', active:true, services:['meta_ads','google_ads'], advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}] }
const task = (id, extras={}) => ({id,clientId:'c',text:'Revisar resultados',resolved:false,...extras})
const store = pending => ({clients:[structuredClone(client)],pending,reviews:[],closed:[]})

test('next actions contain only explicit open, nonempty tasks for existing active accounts', () => {
  const data = store([task('meta',{platform:'meta_ads'}),task('google',{platform:'google_ads'}),task('general'),task('done',{resolved:true}),task('blank',{text:' \n '}),task('malformed',{text:undefined}),task('deleted',{clientId:'missing'})])
  assert.deepEqual(openPendingTasks(data).map(t=>t.id),['meta','google','general'])
  assert.deepEqual(visiblePendingTasks(data).map(t=>t.id),['meta','google','general','done'],'Resolved records remain available without appearing as open tasks')
})

test('archiving Meta hides only its tasks, general legacy tasks appear once, reactivating restores open history', () => {
  const data=store([task('m',{platform:'meta_ads'}),task('g',{platform:'google_ads'}),task('legacy')])
  data.clients=[togglePlatform(client,'meta_ads')]
  assert.deepEqual(openPendingTasks(data).map(t=>t.id),['g','legacy'])
  data.clients=[togglePlatform(data.clients[0],'google_ads')]
  assert.deepEqual(openPendingTasks(data),[])
  data.clients=[togglePlatform(data.clients[0],'meta_ads')]
  assert.deepEqual(openPendingTasks(data).map(t=>t.id),['m','legacy'])
})

test('scheduled/completed actions, observations, unreviewed accounts and Companion activity never invent tasks', () => {
  const data=store([])
  data.reviews=[{id:'r',clientId:'c',platform:'meta_ads',date:'2026-10-15',createdAt:'2026-10-15T12:00:00Z',actions:'Programé publicación',observations:'Revisar CPA mañana',actionEntries:[{id:'a',typeId:'meta.story.scheduled',quantity:1,source:'manual',evidence:'user_confirmed',scheduledDays:['fri']}]}]
  data.activity=[{id:'s',clientId:'c',platform:'google_ads',status:'pending'}]
  assert.deepEqual(openPendingTasks(data),[])
})

test('period changes and closed weeks do not hide saved follow-ups; selecting tasks never mutates storage', () => {
  const data=store([task('old')]);data.closed=['2024-01-01']
  const original=structuredClone(data)
  assert.deepEqual(openPendingTasks(data).map(t=>t.id),['old'])
  assert.deepEqual(data,original)
  assert.equal(openPendingTasks(data)[0],data.pending[0])
})

test('dashboard and report pending counts share the same visibility rules', () => {
  const data=store([task('m',{platform:'meta_ads'}),task('g',{platform:'google_ads'}),task('done',{resolved:true}),task('empty',{text:''})])
  data.clients=[togglePlatform(client,'meta_ads')]
  assert.deepEqual(activeReportStore(data).pending.filter(t=>!t.resolved),openPendingTasks(data))
  data.pending[1].resolved=true
  assert.equal(openPendingTasks(data).length,0)
  assert.equal(data.pending.length,4,'Completing never deletes records')
})
