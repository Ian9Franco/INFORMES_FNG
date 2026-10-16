// All Auth/REST/Realtime data below is fictional. This never connects to a live database.
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const [url,modulePath,chrome,output]=process.argv.slice(2)
const {chromium}=require(modulePath)
const {PDFDocument}=require(path.join(path.dirname(modulePath),'pdf-lib'))
const browser=await chromium.launch({executablePath:chrome,headless:true})
const uid='00000000-0000-4000-8000-000000000111'
const user={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.signature`
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})
const previous=new Date(`${today}T12:00:00`);previous.setDate(previous.getDate()-1)
const yesterday=previous.toLocaleDateString('en-CA')
const row=(kind,id,payload,version=1)=>({user_id:uid,kind,id,payload,version,deleted:false,review_date:payload.date??null,updated_at:new Date().toISOString()})
const action=(typeId,quantity=1,extra={})=>({id:typeId,typeId,quantity,source:'manual',evidence:'user_confirmed',...extra})
const rows=new Map([
  row('client','a',{id:'a',name:'ALAMO',active:true,services:['meta_ads'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''}]}),
  row('client','b',{id:'b',name:'ORGÁNICO Y GOOGLE',active:true,services:['google_ads','meta_organic'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000002',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}]}),
  row('client','c',{id:'c',name:'HISTÓRICO',active:true,services:['meta_ads','meta_organic'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000003',owner:''}]}),
  row('review','old',{id:'old',clientId:'c',platform:'meta_ads',date:yesterday,createdAt:`${yesterday}T12:00:00Z`,actions:'Nota antigua conservada',observations:'',actionSchemaVersion:1,actionEntries:[action('meta.ad.created',7),action('meta.story.scheduled',2,{scheduledDays:['sat','sun']})]}),
  row('condition','status-a',{id:'status-a',clientId:'a',service:'meta_ads',date:'2026-09-30',reviewId:'previous-month',issues:[{type:'no_budget',detail:'Esperando recarga'}]}),
  row('settings','workspace',{accountCatalogVersion:2}),
].map(r=>[`${r.kind}:${r.id}`,r]))
const sockets=new Set(),writes=[],errors=[]
const resume=process.argv[6]??''
const reportsOnly=['reports','density','monthly'].includes(resume)
if(resume)rows.set('review:confirmed-a',row('review','confirmed-a',{id:'confirmed-a',clientId:'a',platform:'meta_ads',service:'meta_ads',date:today,createdAt:`${today}T12:00:00Z`,actions:'',observations:'',actionSchemaVersion:1,actionEntries:[],issues:[{type:'no_budget',detail:'Esperando recarga'}]}))
if(reportsOnly)for(const [id,clientId,service,entries] of [['confirmed-a','a','meta_ads',[action('meta.ad.created',2),action('meta.campaign.created')]],['post-b','b','meta_organic',[action('meta.post.scheduled',1,{scheduledDays:['sat','sun']})]],['google-b','b','google_ads',[action('google.keyword.updated',3)]]])rows.set(`review:${id}`,row('review',id,{id,clientId,platform:service==='google_ads'?'google_ads':'meta_ads',service,date:today,createdAt:`${today}T12:00:00Z`,actions:'',observations:'',actionSchemaVersion:1,actionEntries:entries,issues:clientId==='a'?[{type:'error',detail:'Pago rechazado'}]:[]}))
if(resume==='density')for(let i=0;i<37;i++) {
  const id=`fixture-${i}`;rows.set(`client:${id}`,row('client',id,{id,name:`CLIENTE ${String(i+1).padStart(2,'0')}`,active:true,services:i<27?['meta_ads']:['meta_ads','google_ads','meta_organic']}))
  const monday=new Date(`${today}T12:00:00`);monday.setDate(monday.getDate()-(monday.getDay()+6)%7)
  for(let d=0;d<5;d++) {
    const when=new Date(monday);when.setDate(when.getDate()+d);const date=when.toLocaleDateString('en-CA')
    const entries=d===1||d===4?[action('meta.ad.created',2),action('meta.ad.updated',3)]:[]
    const reviewId=`fixture-review-${i}-${d}`;rows.set(`review:${reviewId}`,row('review',reviewId,{id:reviewId,clientId:id,platform:'meta_ads',service:'meta_ads',date,createdAt:`${date}T12:00:00Z`,actions:'',observations:'',actionSchemaVersion:1,actionEntries:entries}))
  }
}
let currentPage
function broadcast(updated) {
  for(const {ws,topic} of sockets)for(const record of updated)ws.send(JSON.stringify([null,null,topic,'postgres_changes',{ids:[1],data:{schema:'public',table:'fng_records',type:record.version===1?'INSERT':'UPDATE',columns:[],record,old_record:{}}}]))
}
async function client(width,theme) {
  const context=await browser.newContext({viewport:{width,height:940},timezoneId:'America/Argentina/Buenos_Aires'})
  await context.addInitScript(({jwt,user,theme})=>{
    localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}))
    localStorage.setItem('informe-ian-theme',theme)
  },{jwt,user,theme})
  await context.route('**/auth/v1/**',route=>route.fulfill({json:user}))
  await context.route('**/rest/v1/**',async route=>{
    const request=route.request(),parsed=new URL(request.url())
    if(parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
      const changes=request.postDataJSON().changes;writes.push(...changes)
      const updated=changes.map(change=>({...row(change.kind,change.id,change.payload,(rows.get(`${change.kind}:${change.id}`)?.version??0)+1),deleted:change.deleted??false}))
      updated.forEach(record=>rows.set(`${record.kind}:${record.id}`,record))
      const derived=updated.filter(r=>r.kind==='review').map(r=>{
        const service=r.payload.service??r.payload.platform,id=r.payload.clientId==='a'?'status-a':`status-${r.payload.clientId}-${service}`
        return row('condition',id,{id,clientId:r.payload.clientId,service,date:r.payload.date,reviewId:r.id,issues:r.payload.issues??[]},(rows.get(`condition:${id}`)?.version??0)+1)
      })
      derived.forEach(record=>rows.set(`${record.kind}:${record.id}`,record));await route.fulfill({json:updated});broadcast([...updated,...derived]);return
    }
    let selected=[...rows.values()]
    for(const [field,condition] of parsed.searchParams) {
      if(!['kind','id','user_id','review_date'].includes(field))continue
      const [op,...rest]=condition.split('.'),value=rest.join('.')
      selected=selected.filter(item=>op==='eq'?item[field]===value:op==='neq'?item[field]!==value:op==='gte'?item[field]>=value:op==='lt'?item[field]<value:op==='in'?value.replace(/[()]/g,'').split(',').includes(item[field]):true)
    }
    return route.fulfill({json:selected})
  })
  const page=await context.newPage();currentPage=page;page.on('pageerror',e=>errors.push(e.message))
  await page.routeWebSocket('**/realtime/v1/**',ws=>ws.onMessage(message=>{
    const [joinRef,ref,topic,event,payload]=JSON.parse(String(message))
    if(event==='phx_join'){sockets.add({ws,joinRef,topic});ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]))}
    if(event==='heartbeat')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))
  }))
  await page.goto(url);await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  return {page,context}
}
async function navigate(page,name,key) {
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:name==='Mi jornada'?/^Mi jornada/:name,exact:true}).click()
  await page.waitForFunction(key=>{const el=document.querySelector(`.notebook-page[data-page="${key}"]`);return el&&Number(getComputedStyle(el).opacity)>.999&&getComputedStyle(el).transform==='none'},key)
}
const reviewRow=(page,id,service)=>page.locator(`.review-item[data-client-id="${id}"][data-platform="${service}"]`)
async function save(page) {await page.locator('.rapid-save-bar .save-button').click();await page.waitForTimeout(800)}
try {
  await mkdir(output,{recursive:true})
  const pc=await client(1440,'light'),phone=await client(390,'dark')
  if(!reportsOnly) {
  assert.equal(await reviewRow(pc.page,'b','meta_ads').count(),0)
  assert.equal(await reviewRow(pc.page,'b','google_ads').count(),1)
  assert.equal(await reviewRow(pc.page,'b','meta_organic').count(),1)
  assert.match(await reviewRow(pc.page,'a','meta_ads').innerText(),/Sin presupuesto/,'Previous-month condition loaded from metadata')
  assert.equal(writes.length,0,'Reading and projecting legacy history must not upload snapshots')
  if(!resume)await reviewRow(pc.page,'a','meta_ads').locator('.one-touch-review').click()
  await phone.page.waitForFunction(()=>document.querySelector('.review-item[data-client-id="a"] .review-state')?.getAttribute('data-confirmed')==='true')
  assert.match(await reviewRow(phone.page,'a','meta_ads').innerText(),/Sin presupuesto/)
  assert.equal(await reviewRow(phone.page,'a','meta_ads').locator('.review-state.has-issue').count(),1)
  console.log('Realtime confirmation and previous-month issue carry passed')
  assert.equal(rows.get('client:a').payload.active,true,'No-budget must never archive a client')
  await reviewRow(pc.page,'a','meta_ads').locator('.quick-register').click()
  const issues=pc.page.getByRole('region',{name:'Incidencias de la revisión',exact:true})
  await issues.getByRole('button',{name:'Sin presupuesto',exact:true}).click()
  await issues.getByRole('button',{name:'Con error',exact:true}).click()
  await issues.getByLabel('Qué error detectaste',{exact:true}).fill('Pago rechazado')
  await pc.page.locator('.available-action-tags button[data-action-type-id="meta.ad.created"]').click()
  await pc.page.getByLabel('Cantidad: Añadí anuncios',{exact:true}).fill('2')
  await pc.page.getByRole('button',{name:'Más acciones · personalizar favoritas',exact:true}).click()
  await pc.page.locator('.available-action-tags button[data-action-type-id="meta.campaign.created"]').click()
  await save(pc.page)
  await phone.page.waitForFunction(()=>document.querySelector('.review-item[data-client-id="a"] .review-name small')?.textContent.includes('Pago rechazado'))
  assert.equal(writes.filter(w=>w.kind==='condition').length,0,'Derived metadata must never echo as client writes')
  console.log('Issue edit, scoped actions and derived-metadata no-echo passed')
  await reviewRow(pc.page,'b','meta_organic').locator('.quick-register').click()
  assert.equal(await pc.page.locator('.available-action-tags button[data-action-type-id="meta.ad.created"]').count(),0)
  assert.equal(await pc.page.getByRole('button',{name:'Sin presupuesto',exact:true}).count(),0,'Organic is not a paid budget workflow')
  await pc.page.locator('.available-action-tags button[data-action-type-id="meta.post.scheduled"]').click()
  await pc.page.locator('.story-day-trigger').click()
  const menu=pc.page.getByRole('dialog',{name:'Días de la publicación programada',exact:true})
  for(const day of ['sábado','domingo'])if(await menu.getByRole('checkbox',{name:day,exact:true}).getAttribute('aria-checked')!=='true')await menu.getByRole('checkbox',{name:day,exact:true}).click()
  for(const day of ['lunes','martes','miércoles','jueves','viernes'])if(await menu.getByRole('checkbox',{name:day,exact:true}).getAttribute('aria-checked')==='true')await menu.getByRole('checkbox',{name:day,exact:true}).click()
  await menu.getByRole('button',{name:'Listo',exact:true}).click();await save(pc.page)
  console.log('Organic service and weekend programming passed')
  await reviewRow(pc.page,'b','google_ads').locator('.quick-register').click()
  await pc.page.locator('.available-action-tags button[data-action-type-id="google.keyword.updated"]').click()
  await pc.page.getByLabel('Cantidad: Actualicé keywords',{exact:true}).fill('3');await save(pc.page)
  assert.match(await reviewRow(pc.page,'b','google_ads').locator('.service-progress').innerText(),/1 día revisado/)
  await phone.page.reload();await phone.page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  assert.match(await reviewRow(phone.page,'a','meta_ads').innerText(),/Pago rechazado/)
  await reviewRow(phone.page,'a','meta_ads').locator('.quick-register').click()
  await phone.page.screenshot({path:`${output}/services-mobile-dark.png`,fullPage:true})
  await reviewRow(phone.page,'a','meta_ads').locator('.quick-register').click()
  }
  await navigate(pc.page,'Informes','informes')
  const legend=pc.page.locator('.report-preview-wrap .simple-action-legend')
  assert.equal(await legend.count(),1,'A single dictionary belongs above the summary table, not below it')
  assert.match(await legend.innerText(),/Guía rápida · MA: Meta Ads/)
  assert.match(await legend.innerText(),/An\+: Añadí anuncios/)
  assert.match(await legend.innerText(),/Feed: Programé publicación/)
  assert.match(await legend.innerText(),/An\+2 = 2 anuncios añadidos/)
  assert.ok(await legend.evaluate(el=>Boolean(el.nextElementSibling?.matches('table'))),'Dictionary precedes the table inside the measured A4 content')
  if(resume==='monthly') {
    await pc.page.getByRole('button',{name:'Histórico mensual',exact:true}).click()
    const simple=pc.page.locator('.report-preview-wrap .report-grid');await simple.waitFor()
    assert.equal(await simple.getByRole('columnheader',{name:'REV.',exact:true}).count(),1)
    await pc.page.pdf({path:`${output}/services-simple-month.pdf`,preferCSSPageSize:true,printBackground:true})
    assert.equal((await PDFDocument.load(await readFile(`${output}/services-simple-month.pdf`))).getPageCount(),1)
    console.log(JSON.stringify({status:'PASS',stage:'monthly-header',pageErrors:errors}))
  } else {
  let simple=pc.page.locator('.report-preview-wrap .report-grid')
  await simple.waitFor();assert.match(await simple.innerText(),/An\+2/);assert.match(await simple.innerText(),/Camp1/)
  assert.match(await simple.innerText(),/KW3/);assert.match(await simple.innerText(),/Feed1\(Sáb\/Dom\)/);assert.match(await simple.innerText(),/Con error/)
  await simple.screenshot({path:`${output}/services-simple-week.png`})
  await pc.page.pdf({path:`${output}/services-simple-week.pdf`,preferCSSPageSize:true,printBackground:true})
  assert.equal((await PDFDocument.load(await readFile(`${output}/services-simple-week.pdf`))).getPageCount(),1)
  if(resume==='density') {
    const fit=await simple.evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--report-content-scale'))||1)
    assert.ok(fit>=.85,'The one-page summary must not become microscopic with 40 clients')
    console.log(JSON.stringify({status:'PASS',stage:'density',clients:40,pdfPages:1,scale:fit,actionFontPt:8.5*fit,pageErrors:errors}));
  } else {
  await pc.page.locator('.report-mode').getByRole('button',{name:/^Detallado/}).click()
  const detail=pc.page.locator('.detail-preview-pages');await detail.waitFor()
  assert.match(await detail.innerText(),/Pago rechazado/);assert.match(await detail.innerText(),/Meta orgánico/);assert.match(await detail.innerText(),/Añadí anuncios: 2/)
  await pc.page.pdf({path:`${output}/services-detailed-week.pdf`,preferCSSPageSize:true,printBackground:true})
  await pc.page.locator('.report-mode').getByRole('button',{name:/^Simple/}).click()
  await pc.page.getByRole('button',{name:'Histórico mensual',exact:true}).click();await pc.page.waitForTimeout(700)
  assert.match(await simple.innerText(),/KW3/)
  await pc.page.pdf({path:`${output}/services-simple-month.pdf`,preferCSSPageSize:true,printBackground:true})
  assert.equal((await PDFDocument.load(await readFile(`${output}/services-simple-month.pdf`))).getPageCount(),1)
  await navigate(pc.page,'Clientes','clientes')
  await pc.page.getByRole('region',{name:'Clientes Meta Ads',exact:true}).getByRole('button',{name:'Archivar HISTÓRICO',exact:true}).click()
  assert.equal(await pc.page.getByRole('region',{name:'Clientes Meta orgánico',exact:true}).getByText('HISTÓRICO',{exact:true}).count(),1)
  await navigate(pc.page,'Informes','informes');assert.doesNotMatch(await simple.innerText(),/An\+7/);assert.match(await simple.innerText(),/H2/)
  assert.equal(writes.filter(w=>w.kind==='review'&&w.id==='old').length,0,'Legacy projections must not rewrite original history on reads')
  assert.equal(writes.filter(w=>w.kind==='condition').length,0)
  assert.deepEqual(errors,[])
  for(const page of [pc.page,phone.page])assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
  console.log(JSON.stringify({status:'PASS',stage:resume||'all',checks:[...(!reportsOnly?['three services without fabricated IDs','no-budget reviewed, not archived','previous-month status from compact metadata','issue editing controls','PC→phone realtime and reload','no derived write echo','organic weekday scheduling','weekly flexible progress']:[]),'simple weekly/monthly actions and issues','one-page simple PDFs','detailed report labels','independent service archive without history mutation'],pageErrors:errors,writes:writes.map(w=>({kind:w.kind,service:w.payload.service}))},null,2))
  }
  }
}catch(error){console.log(JSON.stringify({errors,writes:writes.map(w=>({kind:w.kind,service:w.payload.service}))}));if(currentPage)await currentPage.screenshot({path:`${output}/services-failure.png`,fullPage:true}).catch(()=>{});throw error}
finally{await browser.close()}
