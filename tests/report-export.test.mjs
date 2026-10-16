import test from 'node:test'
import assert from 'node:assert/strict'
import { activeReportStore, reportFileName } from '../src/report-export.ts'

test('exports distinguish simple/detailed and weekly/monthly for both PDF and PNG', () => {
  const names = ['week','month'].flatMap(period => ['grilla','detalle'].map(mode => reportFileName('Informe Ian', period, period === 'month' ? '2026-10' : '2026-10-12', mode)))
  assert.equal(new Set(names).size, 4)
  assert.deepEqual(names, ['Informe Ian - semanal 2026-10-12 - simple','Informe Ian - semanal 2026-10-12 - detallado','Informe Ian - mensual 2026-10 - simple','Informe Ian - mensual 2026-10 - detallado'])
})
test('export title removes forbidden filename characters without losing Spanish names', () => {
  assert.equal(reportFileName('Informe: acción / Ian. ', 'month', '2026-10', 'grilla'), 'Informe- acción - Ian - mensual 2026-10 - simple')
  assert.equal(reportFileName('   ', 'week', '2026-10-12', 'detalle'), 'Informe Ian - semanal 2026-10-12 - detallado')
})

test('reports omit archived and deleted clients including their historical reviews and tasks without mutating storage', () => {
  const store = { clients:[{id:'a',name:'Activo',active:true},{id:'b',name:'Archivado',active:false}],reviews:[{id:'r1',clientId:'a'},{id:'r2',clientId:'b'},{id:'r3',clientId:'deleted'}],pending:[{id:'p1',clientId:'a'},{id:'p2',clientId:'b'},{id:'p3',clientId:'deleted'}].map(task=>({...task,text:'Revisar presupuesto',resolved:false})),closed:[] }
  const original = structuredClone(store)
  const report = activeReportStore(store)
  assert.deepEqual(report.clients.map(c=>c.id),['a'])
  assert.deepEqual(report.reviews.map(r=>r.id),['r1'])
  assert.deepEqual(report.pending.map(p=>p.id),['p1'])
  assert.deepEqual(store,original)
  store.clients[1].active = true
  assert.deepEqual(activeReportStore(store).reviews.map(r=>r.id),['r1','r2'],'Reactivating restores its history to the report')
})
test('reports with no active clients have no orphaned reviews or pending counts', () => {
  const report = activeReportStore({clients:[],reviews:[{id:'r',clientId:'deleted'}],pending:[{id:'p',clientId:'deleted'}],closed:[]})
  assert.equal(report.reviews.length,0)
  assert.equal(report.pending.length,0)
})
