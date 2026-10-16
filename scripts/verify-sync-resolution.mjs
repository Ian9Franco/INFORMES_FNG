// Isolated browser regression. Auth, REST and Realtime never reach the real DB.
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const [url,modulePath,chrome,output]=process.argv.slice(2)
const {chromium}=require(modulePath)
const browser=await chromium.launch({executablePath:chrome,headless:true})
const uid='00000000-0000-4000-8000-000000000111'
const user={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.signature`
const row=(kind,id,payload,version=1)=>({user_id:uid,kind,id,payload,version,deleted:false,review_date:payload.date??null,client_id:payload.clientId??null,updated_at:new Date().toISOString()})
const review=(id,clientId,observations)=>({id,clientId,platform:'meta_ads',service:'meta_ads',date:new Date().toISOString().slice(0,7)+'-14',createdAt:'2026-10-14T12:00:00Z',actions:'',observations,issues:[],actionEntries:[]})
await mkdir(output,{recursive:true})
try {
for(const [width,theme] of [[390,'dark'],[1440,'light']]) {
  const rows=new Map([
    ...['a','b','c'].map((id,i)=>row('client',id,{id,name:['ALAMO','BOSQUE','CAUCE'][i],active:true,services:['meta_ads']})),
    row('review','remote-a',review('remote-a','a','Nube A'),2),
    row('review','remote-b',review('remote-b','b','Nube B'),3),
    row('review','remote-c',review('remote-c','c','Nube C'),1),
    row('settings','workspace',{accountCatalogVersion:2}),
  ].map(item=>[`${item.kind}:${item.id}`,item]))
  const queued=[['remote-a','a','Local A',1],['offline-b','b','Local B',0],['remote-c','c','Validación pendiente',1]].map(([id,clientId,note,expectedVersion])=>({kind:'review',id,payload:review(id,clientId,note),expectedVersion,deleted:false}))
  const context=await browser.newContext({viewport:{width,height:940}})
  await context.addInitScript(({jwt,user,theme,queued,uid})=>{
    localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}))
    localStorage.setItem('informe-ian-theme',theme)
    if(!localStorage.getItem('qa-conflicts-seeded')){localStorage.setItem(`fng-outbox:${uid}`,JSON.stringify(queued));localStorage.setItem('qa-conflicts-seeded','true')}
  },{jwt,user,theme,queued,uid})
  const writes=[],errors=[]
  await context.route('**/auth/v1/**',route=>route.fulfill({json:user}))
  await context.route('**/rest/v1/**',async route=>{
    const request=route.request(),parsed=new URL(request.url())
    if(parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
      const changes=request.postDataJSON().changes;writes.push(changes)
      if(changes.some(change=>change.id==='remote-c'))return route.fulfill({status:400,json:{code:'P0001',message:'Datos de una versión anterior; actualizá el registro'}})
      for(const change of changes) {
        const existing=rows.get(`${change.kind}:${change.id}`)
        if(!existing||existing.version!==change.expectedVersion)return route.fulfill({status:409,json:{code:'40001',message:`FNG_CONFLICT:${change.kind}:${change.id}`}})
      }
      const updated=changes.map(change=>({...row(change.kind,change.id,change.payload,rows.get(`${change.kind}:${change.id}`).version+1),deleted:change.deleted}))
      updated.forEach(item=>rows.set(`${item.kind}:${item.id}`,item));return route.fulfill({json:updated})
    }
    let selected=[...rows.values()]
    for(const [field,condition] of parsed.searchParams) {
      if(!['kind','id','user_id','client_id','review_date'].includes(field))continue
      const [op,...rest]=condition.split('.'),value=rest.join('.')
      selected=selected.filter(item=>op==='eq'?item[field]===value:op==='neq'?item[field]!==value:op==='gte'?item[field]>=value:op==='lt'?item[field]<value:op==='in'?value.replace(/[()]/g,'').split(',').includes(item[field]):true)
    }
    return route.fulfill({json:selected})
  })
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
  await page.routeWebSocket('**/realtime/v1/**',ws=>ws.onMessage(message=>{
    const [joinRef,ref,topic,event,payload]=JSON.parse(String(message))
    if(event==='phx_join')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]))
    if(event==='heartbeat')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))
  }))
  await page.goto(url)
  await page.getByRole('button',{name:'Mi cuenta · DB · revisar',exact:true}).waitFor()
  await page.waitForTimeout(700)
  assert.equal(await page.getByText('Otro dispositivo cambió este registro:',{exact:false}).count(),0)
  assert.equal(await page.locator('.sync-conflicts').count(),0,'No repeated banners push the notebook down')
  await page.getByRole('button',{name:'Mi cuenta · DB · revisar',exact:true}).click()
  await page.getByRole('button',{name:'Revisar cambios (3)',exact:true}).click()
  const panel=page.getByRole('dialog',{name:'Revisar cambios',exact:true})
  await panel.waitFor();assert.equal(await panel.locator('.sync-problem').count(),3)
  for(const name of ['ALAMO','BOSQUE','CAUCE'])assert.match(await panel.innerText(),new RegExp(`${name} · Meta Ads`))
  const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Descargar copia local',exact:true}).click()
  await (await download).saveAs(`${output}/pending-${width}.json`)
  assert.equal(await panel.locator('.sync-problem').count(),3,'Backup is not an implicit decision or data discard')
  await page.screenshot({path:`${output}/panel-${width}-${theme}.png`})
  const detail=name=>panel.locator('.sync-problem').filter({has:page.locator('summary',{hasText:name})})
  await detail('ALAMO').locator('summary').click()
  await detail('ALAMO').getByRole('button',{name:'Usar versión de la nube',exact:true}).click()
  await detail('ALAMO').waitFor({state:'detached'})
  await detail('BOSQUE').locator('summary').click()
  await detail('BOSQUE').getByRole('button',{name:'Conservar mi versión',exact:true}).click()
  await detail('BOSQUE').waitFor({state:'detached'})
  await page.waitForFunction(({uid})=>JSON.parse(localStorage.getItem(`fng-outbox:${uid}`)||'[]').every(change=>change.id!=='remote-b'),{uid})
  assert.equal(rows.get('review:remote-b').payload.observations,'Local B')
  assert.equal(rows.get('review:remote-a').payload.observations,'Nube A')
  assert.equal(rows.has('review:offline-b'),false)
  await detail('CAUCE').locator('summary').click()
  await detail('CAUCE').getByRole('button',{name:'Usar nube / quitar este pendiente',exact:true}).click()
  await panel.getByRole('status').filter({hasText:'No quedan cambios por revisar'}).waitFor()
  await panel.getByRole('button',{name:'Volver a mi libreta',exact:true}).click()
  await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  const requests=writes.length
  await page.reload();await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  await page.waitForTimeout(600)
  assert.equal(writes.length,requests,'Resolved choices survive reload with no write echo')
  assert.equal(requests,2,'One rejected write plus one explicit save, not an endless retry loop')
  assert.deepEqual(errors,[])
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  console.log(JSON.stringify({status:'PASS',width,theme,checks:['no top spam','named per-service records','safe backup','cloud choice durable','different UUID resolved canonically','validation not conflict','reload no retries'],writeBatches:requests,pageErrors:errors}))
  await context.close()
}
}finally{await browser.close()}
