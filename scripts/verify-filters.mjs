// UI regression fixtures only: no real sessions, customer identifiers or database writes.
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
const errors=[],results=[]
let currentPage
async function navigate(page,name,key) {
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:name==='Mi jornada'?/^Mi jornada/:name,exact:true}).click()
  await page.waitForFunction(key=>{const el=document.querySelector(`.notebook-page[data-page="${key}"]`);return el&&Number(getComputedStyle(el).opacity)>.999&&getComputedStyle(el).transform==='none'},key)
}
async function slide(page,label,target,reduced) {
  const group=page.getByRole('group',{name:label,exact:true}),button=group.getByRole('button',{name:target,exact:true})
  await group.scrollIntoViewIfNeeded();await button.focus();await page.waitForTimeout(80)
  const from=await group.locator('.filter-highlight').boundingBox(),to=await button.boundingBox()
  await group.evaluate(element=>{
    window.filterFrames=[];window.filterSampling=true
    const tick=()=>{
      if(!window.filterSampling)return
      const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}
      window.filterFrames.push({pill:rect(element.querySelector('.filter-highlight')),buttons:[...element.querySelectorAll('button')].map(rect)})
      requestAnimationFrame(tick)
    };tick()
  })
  await page.keyboard.press('Enter');await page.waitForTimeout(750)
  const frames=await page.evaluate(()=>{window.filterSampling=false;return window.filterFrames})
  assert.equal(await button.getAttribute('aria-pressed'),'true')
  assert.equal(await group.locator('.filter-highlight').count(),1)
  assert.ok(frames.length>8,`${label}: insufficient frames`)
  for(const frame of frames) for(let i=0;i<frame.buttons.length;i++) for(const key of ['x','y','width','height']) {
    assert.ok(Math.abs(frame.buttons[i][key]-frames[0].buttons[i][key])<.75,`${label}: button ${i} ${key} jumped`)
  }
  if(!reduced) {
    const low=Math.min(from.x,to.x)+2,high=Math.max(from.x,to.x)-2
    assert.ok(frames.filter(f=>f.pill.x>low&&f.pill.x<high).length>=4,`${label}: indicator snapped instead of sliding`)
  }
  const end=frames.at(-1).pill
  assert.ok(Math.abs(end.x-to.x)<1&&Math.abs(end.width-to.width)<1,`${label}: misaligned selection`)
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),target,'Keyboard focus remains on selected filter')
  return frames.length
}
try {
  await mkdir(output,{recursive:true})
  for(const width of [1440,390,320]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:940},timezoneId:'America/Argentina/Buenos_Aires'})
    await context.addInitScript(({jwt,user,theme})=>{
      localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}))
      localStorage.setItem('informe-ian-theme',theme)
    },{jwt,user,theme})
    const row=(kind,id,payload)=>({user_id:uid,kind,id,payload,version:1,deleted:false,review_date:payload.date??null})
    const bindings=[{platform:'meta_ads',accountId:'9000000000000001',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}]
    const task=(id,text,platform,clientId='a',resolved=false)=>row('task',id,{id,clientId,text,resolved,...(platform?{platform}:{})})
    const rows=new Map([
      row('client','a',{id:'a',name:'ALAMO',active:true,advertisingAccounts:bindings}),
      row('client','b',{id:'b',name:'BOSQUE',active:true,archivedPlatforms:['meta_ads'],advertisingAccounts:bindings}),
      row('client','c',{id:'c',name:'CEDRO',active:false,advertisingAccounts:bindings}),
      row('settings','workspace',{accountCatalogVersion:2}),
      task('meta','Revisar campaña Meta','meta_ads'),task('google','Actualizar keywords','google_ads'),task('legacy','Pendiente antiguo sin plataforma'),
      task('hidden-meta','No mostrar Meta archivado','meta_ads','b'),task('visible-google','Revisar Google activo','google_ads','b'),
      task('hidden-client','No mostrar cliente archivado','meta_ads','c'),task('orphan','No mostrar eliminado','meta_ads','missing'),task('blank',' \n '),task('done','Ya completado','meta_ads','a',true),
    ].map(item=>[`${item.kind}:${item.id}`,item]))
    const writes=[]
    await context.route('**/auth/v1/**',route=>route.fulfill({json:user}))
    await context.route('**/rest/v1/**',route=>{
      const request=route.request(),parsed=new URL(request.url())
      if(parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
        const changes=request.postDataJSON().changes;writes.push(...changes)
        const updated=changes.map(change=>({...row(change.kind,change.id,change.payload),version:(rows.get(`${change.kind}:${change.id}`)?.version??0)+1,deleted:change.deleted??false}))
        updated.forEach(item=>rows.set(`${item.kind}:${item.id}`,item));return route.fulfill({json:updated})
      }
      let selected=[...rows.values()]
      for(const [field,condition] of parsed.searchParams) {
        if(!['kind','id','user_id','review_date'].includes(field))continue
        const [op,...rest]=condition.split('.'),value=rest.join('.')
        selected=selected.filter(item=>op==='eq'?item[field]===value:op==='neq'?item[field]!==value:op==='gte'?item[field]>=value:op==='lt'?item[field]<value:op==='in'?value.replace(/[()]/g,'').split(',').includes(item[field]):true)
      }
      return route.fulfill({json:selected})
    })
    const page=await context.newPage();currentPage=page
    page.on('pageerror',error=>errors.push(error.message))
    await page.routeWebSocket('**/realtime/v1/**',ws=>ws.onMessage(message=>{
      const [joinRef,ref,topic,event,payload]=JSON.parse(String(message))
      if(event==='phx_join')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]))
      if(event==='heartbeat')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))
    }))
    await page.goto(url);await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
    const panel=page.getByRole('region',{name:'Próximas acciones',exact:true})
    assert.equal(await panel.locator('.task-row').count(),4)
    assert.equal(await panel.locator('.count-chip').textContent(),'4')
    assert.equal(await panel.getByText('General',{exact:true}).count(),1)
    assert.equal(await panel.getByText('Meta Ads',{exact:true}).count(),1)
    assert.equal(await panel.getByText('Google Ads',{exact:true}).count(),2)
    assert.equal(await panel.getByText(/No mostrar|Ya completado/).count(),0)
    await slide(page,'Filtrar revisiones de hoy','Revisados',false)
    assert.equal(await page.locator('.review-item').count(),0)
    assert.equal(await page.getByText('Todavía no hay revisiones registradas hoy en esta plataforma.',{exact:true}).count(),2)
    await slide(page,'Filtrar revisiones de hoy','Por revisar',false)
    assert.equal(await page.locator('.review-item').count(),3)
    await slide(page,'Filtrar revisiones de hoy','Todos',false)
    assert.equal(writes.length,0,'Filters must not write to DB')
    await page.getByLabel('Buscar en la jornada',{exact:true}).fill('sin coincidencias')
    assert.equal(await page.getByText('No hay cuentas que coincidan con la búsqueda y el filtro.',{exact:true}).count(),2)
    await page.getByLabel('Buscar en la jornada',{exact:true}).fill('')
    await navigate(page,'Clientes','clientes')
    await slide(page,'Filtrar clientes','Archivados',false)
    assert.equal(await page.getByRole('region',{name:'Clientes Meta Ads',exact:true}).locator('.client-management-row').count(),2)
    assert.equal(await page.getByRole('region',{name:'Clientes Google Ads',exact:true}).locator('.client-management-row').count(),1)
    await slide(page,'Filtrar clientes','Todos',false)
    await slide(page,'Filtrar clientes','Activos',false)
    assert.equal(await page.getByRole('region',{name:'Clientes Meta Ads',exact:true}).locator('.client-management-row').count(),1)
    assert.equal(await page.getByRole('region',{name:'Clientes Google Ads',exact:true}).locator('.client-management-row').count(),2)
    const clientsFilter=page.getByRole('group',{name:'Filtrar clientes',exact:true})
    await clientsFilter.getByRole('button',{name:'Todos',exact:true}).click();await page.waitForTimeout(50)
    await clientsFilter.getByRole('button',{name:'Archivados',exact:true}).click();await page.waitForTimeout(50)
    await clientsFilter.getByRole('button',{name:'Activos',exact:true}).click();await page.waitForTimeout(750)
    assert.equal(await clientsFilter.locator('.filter-highlight').count(),1,'Rapid interruption must leave exactly one indicator')
    await page.emulateMedia({reducedMotion:'reduce'})
    await slide(page,'Filtrar clientes','Todos',true)
    await clientsFilter.getByRole('button',{name:'Activos',exact:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Space')
    assert.equal(await clientsFilter.getByRole('button',{name:'Archivados',exact:true}).getAttribute('aria-pressed'),'true')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await navigate(page,'Mi jornada','jornada')
    await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/filters-tasks-${width}-${theme}.png`,fullPage:true})
    await panel.getByRole('button',{name:'Completar pendiente: Actualizar keywords',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.tasks-panel .count-chip')?.textContent==='3')
    await page.waitForTimeout(600)
    assert.equal(writes.length,1,'Completing a task must update only that entity')
    assert.equal(writes[0].kind,'task');assert.equal(writes[0].id,'google');assert.equal(writes[0].payload.resolved,true)
    await page.reload();await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
    assert.equal(await panel.locator('.task-row').count(),3,'Resolved state survives reload')
    for(const name of ['Revisar campaña Meta','Pendiente antiguo sin plataforma','Revisar Google activo']) await panel.getByRole('button',{name:`Completar pendiente: ${name}`,exact:true}).click()
    assert.equal(await panel.getByRole('heading',{name:'Sin pendientes abiertos',exact:true}).count(),1)
    assert.equal(await page.getByText('Todo al día',{exact:true}).count(),0)
    assert.equal(await page.locator('.review-item').count(),3,'No tasks does not imply accounts are reviewed')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')
    results.push({width,theme,filters:'continuous + interruption + keyboard + reduced motion',tasks:'visibility + platform + scoped write + reload + truthful empty state'})
    await context.close()
  }
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({status:'PASS',results,pageErrors:errors},null,2))
} catch(error) {
  if(currentPage)await currentPage.screenshot({path:`${output}/filters-failure.png`,fullPage:true}).catch(()=>{})
  throw error
} finally {await browser.close()}
