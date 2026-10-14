// Two isolated browsers with deterministic Auth/REST/Realtime simulation.
// Real database CAS/RLS/ingestion are separately tested in rolled-back SQL transactions.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const [url, modulePath, chrome, output] = process.argv.slice(2)
const { chromium } = require(modulePath)
const browser = await chromium.launch({ executablePath: chrome, headless: true })
const uid = '00000000-0000-4000-8000-000000000111'
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.signature`
const rows = new Map()
const key = row => `${row.kind}:${row.id}`
const make = (kind,id,payload,version=1) => ({ user_id:uid,kind,id,payload,version,deleted:false,review_date:payload.date ?? null,updated_at:new Date().toISOString() })
const today = new Date().toLocaleDateString('en-CA', { timeZone:'America/Argentina/Buenos_Aires' })
rows.set('client:a',make('client','a',{id:'a',name:'ALLEGRA',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'1431562859020123',owner:'Allegra'}]}))
rows.set('client:j',make('client','j',{id:'j',name:'JONDE',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'2980180415592669',owner:'Hotel Jonde'}]}))
rows.set('settings:workspace',make('settings','workspace',{accountCatalogVersion:1}))
let writes = 0
const sockets = new Set()
const errors = []
const pages = []
function broadcast(row) {
  for (const ws of sockets) ws.send(JSON.stringify([null,null,`realtime:workspace:${uid}`,'postgres_changes',{ids:[1],data:{schema:'public',table:'fng_records',type:row.version===1?'INSERT':'UPDATE',columns:[],record:row,old_record:{}}}]))
}
async function device() {
  const context = await browser.newContext({ viewport:{width:1280,height:900} })
  await context.addInitScript(({ jwt,user }) => localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})),{jwt,user})
  await context.route('**/auth/v1/**',route => route.fulfill({json:user}))
  await context.route('**/rest/v1/**',async route => {
    const request = route.request(), parsed = new URL(request.url())
    if (parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
      const { changes } = request.postDataJSON()
      for(const change of changes) {
        const existing=rows.get(key(change))
        if (existing && existing.version!==change.expectedVersion && JSON.stringify(existing.payload)!==JSON.stringify(change.payload)) return route.fulfill({status:409,json:{code:'40001',message:`FNG_CONFLICT:${key(change)}`}})
      }
      const updated=changes.map(change=>({...make(change.kind,change.id,change.payload,(rows.get(key(change))?.version??0)+1),deleted:change.deleted}))
      updated.forEach(row=>{rows.set(key(row),row);broadcast(row)})
      writes+=changes.length
      return route.fulfill({json:updated})
    }
    let selected = [...rows.values()]
    for(const [field,condition] of parsed.searchParams) {
      if (!['kind','id','user_id','review_date'].includes(field)) continue
      const [op,...rest]=condition.split('.'), value=rest.join('.')
      selected=selected.filter(row=>op==='eq'?row[field]===value:op==='neq'?row[field]!==value:op==='gte'?row[field]>=value:op==='lt'?row[field]<value:op==='in'?value.replace(/[()]/g,'').split(',').includes(row[field]):true)
    }
    return route.fulfill({json:request.headers().accept?.includes('object+json')?(selected[0]??null):selected})
  })
  const page = await context.newPage()
  pages.push(page)
  page.on('pageerror',error=>errors.push(error.message))
  await page.routeWebSocket('**/realtime/v1/**',ws=>{
    sockets.add(ws)
    ws.onMessage(message=>{
      const [joinRef,ref,topic,event,payload]=JSON.parse(String(message))
      if(event==='phx_join') ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]))
      if(event==='heartbeat') ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))
    })
    ws.onClose(()=>sockets.delete(ws))
  })
  await page.goto(url)
  await page.getByRole('heading',{name:'Mi jornada',exact:true}).waitFor()
  await page.getByRole('status').filter({hasText:'Guardado y sincronizado'}).first().waitFor()
  return {context,page}
}
async function review(page,name,note) {
  await page.getByRole('button',{name:'Registrar revisión',exact:true}).first().click()
  await page.locator('.client-picker-trigger').click()
  await page.getByRole('combobox').fill(name)
  await page.getByRole('combobox').press('Enter')
  await page.getByLabel('Observaciones',{exact:true}).fill(note)
}
try {
  const pc=await device(), phone=await device()
  await phone.page.setViewportSize({width:390,height:844})
  await review(pc.page,'JONDE','Registro de PC')
  await pc.page.getByRole('button',{name:'Guardar revisión',exact:true}).click()
  await pc.page.getByRole('dialog').waitFor({state:'detached'})
  await phone.page.waitForFunction(()=>document.querySelector('.metrics-grid strong')?.textContent==='1')
  assert.equal(writes,1,'Only one changed record should be sent; receiving device must not echo it')
  console.log('PC → Realtime → mobile progress; no echo and one-record write passed')

  await pc.page.locator('.review-row').filter({hasText:'JONDE'}).click()
  await pc.page.getByRole('dialog').waitFor()
  await phone.page.locator('.review-row').filter({hasText:'JONDE'}).click()
  await phone.page.getByRole('dialog').waitFor()
  await pc.page.getByLabel('Observaciones',{exact:true}).fill('PC actualizó la revisión')
  await pc.page.getByRole('button',{name:'Guardar revisión',exact:true}).click()
  await phone.page.waitForFunction(()=>JSON.parse(localStorage.getItem('fng-cache:00000000-0000-4000-8000-000000000111')).reviews[0]?.revision===2)
  await phone.page.getByLabel('Observaciones',{exact:true}).fill('Borrador del teléfono')
  await phone.page.getByRole('button',{name:'Guardar revisión',exact:true}).click()
  await phone.page.getByRole('status').filter({hasText:'Esta revisión cambió en otro dispositivo'}).waitFor()
  assert.equal([...rows.values()].find(row=>row.kind==='review').payload.observations,'PC actualizó la revisión')
  phone.page.on('dialog',dialog=>dialog.accept())
  await phone.page.getByRole('button',{name:'Cerrar',exact:true}).click()

  const event=make('event','00000000-0000-4000-8000-000000000222',{id:'00000000-0000-4000-8000-000000000222',clientId:'a',date:today,platform:'meta_ads',accountCandidate:'1431562859020123',focusedMs:600000,navigationSignals:4,startedAt:new Date(Date.now()-600000).toISOString(),endedAt:new Date().toISOString(),status:'pending'})
  rows.set(key(event),event);broadcast(event)
  await phone.page.getByRole('heading',{name:'Actividad de tu PC'}).waitFor()
  assert.equal(await phone.page.locator('.metrics-grid strong').first().textContent(),'1','Observed activity must not mark a review complete')
  console.log('Concurrent-form protection and Companion evidence inbox passed')

  await pc.context.setOffline(true)
  await review(pc.page,'ALLEGRA','Guardado sin conexión')
  await pc.page.getByRole('button',{name:'Guardar revisión',exact:true}).click()
  await pc.page.waitForFunction(()=>JSON.parse(localStorage.getItem('fng-outbox:00000000-0000-4000-8000-000000000111')??'[]').length>0)
  await pc.context.setOffline(false)
  await phone.page.waitForFunction(()=>document.querySelector('.metrics-grid strong')?.textContent==='2')
  console.log('Durable offline outbox and reconnect passed')

  await pc.page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'Informes',exact:true}).click()
  await pc.page.getByRole('button',{name:'Histórico mensual',exact:true}).waitFor()
  await pc.page.getByRole('button',{name:'Histórico mensual',exact:true}).click()
  await pc.page.getByLabel('Mes',{exact:true}).fill('2026-01')
  await pc.page.waitForFunction(()=>document.querySelector('.report-summary strong')?.textContent==='0')
  assert.equal(await pc.page.locator('.print-paper header small').textContent(),'MES')
  await mkdir(output,{recursive:true})
  await pc.page.screenshot({path:path.join(output,'monthly-cloud.png'),fullPage:true})
  await phone.page.screenshot({path:path.join(output,'mobile-synced.png'),fullPage:true})
  assert.equal(errors.length,0,errors.join('\n'))
  console.log('Historical month filtering and browser runtime checks passed')
} catch (error) {
  await mkdir(output,{recursive:true})
  for (const [index,page] of pages.entries()) { await page.screenshot({path:path.join(output,`failure-${index}.png`),fullPage:true}); console.log(await page.evaluate(()=>({dialogs:[...document.querySelectorAll('dialog')].map(dialog=>({open:dialog.open,classes:dialog.className})),headings:[...document.querySelectorAll('h1,h2')].map(element=>element.textContent),status:document.querySelector('.sync-bar')?.textContent}))) }
  throw error
} finally { await browser.close() }
