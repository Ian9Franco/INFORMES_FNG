import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftChanged, readDrafts, reviewSignature, nextPendingClient } from '../src/review-workflow.ts'

const base={id:'r',clientId:'a',date:'2026-10-14',createdAt:'now',actions:'',observations:'',actionEntries:[]}
test('Borradores do not confirm a review and are scoped by client/date',()=>{
  const draft={clientId:'a',day:'2026-10-14',actions:'',observations:'',actionEntries:[],pendingText:'',updatedAt:'now',base}
  assert.equal(draftChanged(draft),false)
  assert.equal(draftChanged({...draft,observations:'Una nota'}),true)
  assert.equal(draftChanged({...draft,pendingText:'Controlar presupuesto'}),true)
  const storage={getItem:()=>JSON.stringify({'a:2026-10-14':draft,invalid:{...draft,day:'bad'}})}
  assert.deepEqual(Object.keys(readDrafts(storage,'key')),['a:2026-10-14'])
  assert.deepEqual(readDrafts({getItem:()=>'{broken'},'key'),{})
})
test('Undo signatures permit save acknowledgements but reject other edits',()=>{
  assert.equal(reviewSignature(base),reviewSignature({...base,revision:2}))
  assert.notEqual(reviewSignature(base),reviewSignature({...base,observations:'Otra edición'}))
  assert.notEqual(reviewSignature(base),reviewSignature({...base,id:'different'}))
})
test('Guardar y siguiente respects the visible order, skips completed and wraps',()=>{
  const clients=['a','b','c'].map(id=>({id,name:id,active:true}))
  assert.equal(nextPendingClient(clients,[base],base.date,'a').id,'b')
  assert.equal(nextPendingClient(clients,[base],base.date,'c').id,'b')
  assert.equal(nextPendingClient([clients[0]],[base],base.date,'a'),undefined)
  assert.equal(nextPendingClient(clients,[base,{...base,clientId:'b'}],base.date,'a').id,'c')
})
