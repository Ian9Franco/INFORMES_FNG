import test from 'node:test'
import assert from 'node:assert/strict'
import { compactReviewText, paginateDetail } from '../src/report-layout.ts'

const review = { id:'r',clientId:'a',date:'2026-10-15',createdAt:'2026-10-15T12:00:00Z',actions:'',observations:'' }
const item=(id,text='Registro')=>({id,date:'15/10',text})
const block=(id,items=[item(id)])=>({id,title:`Cliente ${id}`,items})
const measure=block=>10+block.items.reduce((sum,item)=>sum+10+item.text.length,0)

test('compact detail preserves actions, observations, weekdays and observed evidence without empty labels',()=>{
  assert.equal(compactReviewText(review),'Revisado sin cambios')
  const text=compactReviewText({...review,actions:'Detalle anterior',observations:'Nota importante',actionEntries:[{id:'a',typeId:'meta.ad.created',quantity:3,source:'manual',evidence:'user_confirmed'},{id:'s',typeId:'meta.post.scheduled',quantity:1,source:'companion',sourceEventId:'source',evidence:'observed',scheduledDays:['fri','mon']}]})
  assert.equal(text.match(/Meta ·/g).length,1)
  assert.match(text,/Añadí anuncios: 3; Programé publicación: 1 \(para lunes, viernes\) \(por confirmar\)/)
  assert.match(text,/Detalle anterior\nObservaciones · Nota importante/)
  assert.doesNotMatch(text,/Sin observaciones/)
})

test('physical pagination uses both columns, keeps short clients together and balances the final sheet',()=>{
  const blocks=Array.from({length:6},(_,i)=>block(String(i)))
  const pages=paginateDetail(blocks,100,4,measure)
  assert.equal(pages.length,1)
  assert.deepEqual(pages[0].columns.map(column=>column.map(block=>block.id)),[['0','1','2'],['3','4','5']])
  assert.equal(paginateDetail([],100,4,measure).length,1)
})

test('long histories add numbered sheets without losing or cutting a normal review',()=>{
  const client=block('a',Array.from({length:12},(_,i)=>item(`r${i}`)))
  const pages=paginateDetail([client],100,4,measure)
  assert.equal(pages.length,2)
  assert.deepEqual(pages.flatMap(page=>page.columns.flatMap(column=>column.flatMap(block=>block.items.map(item=>item.id)))),client.items.map(item=>item.id))
  for(const page of pages) for(const column of page.columns) assert.ok(column.reduce((sum,block)=>sum+measure(block),0)+Math.max(0,column.length-1)*4<=100)
  assert.equal(pages[0].columns[1][0].continued,true)
})

test('a single oversized note continues at text boundaries with every character preserved',()=>{
  const text='Nota extensa con palabras y emoji 🌱. '.repeat(18)
  const pages=paginateDetail([block('a',[item('large',text)])],100,4,measure)
  const items=pages.flatMap(page=>page.columns.flatMap(column=>column.flatMap(block=>block.items)))
  assert.equal(items.map(item=>item.text).join(''),text)
  assert.equal(items[0].continued,false)
  assert.ok(items.slice(1).every(item=>item.continued))
  assert.ok(pages.length>1)
  for(const page of pages) for(const column of page.columns) for(const block of column) assert.ok(measure(block)<=100)
})

test('an oversized note uses remaining column space instead of leaving a mostly empty column',()=>{
  const pages=paginateDetail([block('short'),block('long',[item('long','Una nota de muchas palabras. '.repeat(20))])],100,4,measure)
  assert.equal(pages[0].columns[0].length,2)
  assert.equal(pages[0].columns[0][1].items[0].continued,false)
  assert.equal(pages[0].columns[1][0].continued,true)
})
