// Isolated Auth/REST/Realtime fixtures; no real credentials, customers or database writes.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const require=createRequire(import.meta.url)
const [url,modulePath,chrome,output]=process.argv.slice(2)
const {chromium}=require(modulePath)
const browser=await chromium.launch({executablePath:chrome,headless:true})
const uid='00000000-0000-4000-8000-000000000111'
const user={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.signature`
const errors=[]
let currentPage
async function sample(page,id) {
  await page.evaluate(id=>{
    window.materialFrames=[];window.materialSampling=true
    const tick=()=>{
      if(!window.materialSampling)return
      const row=document.querySelector(`.review-item[data-client-id="${id}"]`)
      window.materialFrames.push(['.review-row','.review-name','.review-state-label','.review-row-tools','.one-touch-review','.quick-register'].map(selector=>{
        const element=row.querySelector(selector)
        if(!element)return null
        const rect=element.getBoundingClientRect()
        return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,scroll:scrollY,documentY:rect.y+scrollY}
      }))
      requestAnimationFrame(tick)
    };tick()
  },id)
}
async function stable(page,label) {
  await page.waitForTimeout(700)
  const frames=await page.evaluate(()=>{window.materialSampling=false;return window.materialFrames})
  assert.ok(frames.length>5)
  for(const frame of frames) for(let i=0;i<frame.length;i++) {
    assert.ok(frame[i]&&frames[0][i],`${label}: slot ${i} unmounted`)
    for(const key of ['x','y','width','height']) assert.ok(Math.abs(frame[i][key]-frames[0][i][key])<1,`${label}: slot ${i} ${key} moved ${frames[0][i][key]} → ${frame[i][key]}, scroll ${frames[0][i].scroll} → ${frame[i].scroll}, documentY ${frames[0][i].documentY} → ${frame[i].documentY}`)
  }
}
async function navigate(page,name) {
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name,exact:true}).click()
  const key=name==='Mi jornada'?'jornada':name.toLowerCase()
  await page.locator(`.notebook-page[data-page="${key}"] .page-header h1`).waitFor()
  await page.waitForFunction(name=>{const el=document.querySelector(`.notebook-page[data-page="${name}"]`);return el&&Number(getComputedStyle(el).opacity)>.999&&getComputedStyle(el).transform==='none'},key)
}
try {
  await mkdir(output,{recursive:true})
  for(const width of process.argv[6]?[Number(process.argv[6])]:[1440,390,320]) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:940}})
    await context.addInitScript(({jwt,user,theme})=>{
      localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}))
      localStorage.setItem('informe-ian-theme',theme)
    },{jwt,user,theme})
    const row=(kind,id,payload)=>({user_id:uid,kind,id,payload,version:1,deleted:false,review_date:payload.date??null})
    const rows=new Map([
      ['client:a',row('client','a',{id:'a',name:'ALAMO',active:true})],
      ['client:b',row('client','b',{id:'b',name:'ESTUDIO DE ARQUITECTURA Y DISEÑO',active:true})],
      ['client:c',row('client','c',{id:'c',name:'TIENDA',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''},{platform:'google_ads',accountId:'9000000001',owner:''}]})],
      ['settings:workspace',row('settings','workspace',{accountCatalogVersion:2})],
    ])
    let writes=0
    await context.route('**/auth/v1/**',route=>route.fulfill({json:user}))
    await context.route('**/rest/v1/**',route=>{
      const request=route.request(),parsed=new URL(request.url())
      if(parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
        const updated=request.postDataJSON().changes.map(change=>({...row(change.kind,change.id,change.payload),version:(rows.get(`${change.kind}:${change.id}`)?.version??0)+1,deleted:change.deleted??false}))
        updated.forEach(item=>rows.set(`${item.kind}:${item.id}`,item));writes+=updated.length
        return route.fulfill({json:updated})
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
    await page.goto(url)
    await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
    await page.waitForTimeout(250)
    const first=page.locator('.review-item[data-client-id="a"]')
    await first.evaluate(element=>element.scrollIntoView({block:'center'}))
    await sample(page,'a')
    await page.getByRole('button',{name:'Revisado sin cambios: ALAMO',exact:true}).click()
    await stable(page,`${width}/${theme} confirmation`)
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Revisión confirmada: ALAMO')
    const count=writes
    await page.keyboard.press('Enter');await page.waitForTimeout(400)
    assert.equal(writes,count,'aria-disabled control must not create duplicate writes')
    await sample(page,'a')
    await page.getByRole('button',{name:'Deshacer',exact:true}).click()
    await stable(page,`${width}/${theme} undo`)

    const second=page.locator('.review-item[data-client-id="b"]')
    await second.evaluate(element=>element.scrollIntoView({block:'center'}))
    await second.locator('.quick-register').focus()
    await sample(page,'b')
    await page.keyboard.press('Enter')
    await stable(page,`${width}/${theme} open/long client name`)
    await second.locator('.quick-register').focus()
    await sample(page,'b')
    await page.keyboard.press('Enter')
    await stable(page,`${width}/${theme} close`)

    await second.locator('.quick-register').focus()
    await page.keyboard.press('Enter');await page.waitForTimeout(600)
    await page.locator('.rapid-save-bar .save-button').focus()
    await sample(page,'b')
    await page.keyboard.press('Enter')
    await stable(page,`${width}/${theme} save/Registrar → Editar`)
    assert.equal(await second.locator('.quick-register').textContent(),'Editar')
    if(width===390&&theme==='dark') {
      await page.emulateMedia({reducedMotion:'reduce'})
      await first.evaluate(element=>element.scrollIntoView({block:'center'}))
      await sample(page,'a')
      await first.locator('.one-touch-review').focus()
      await page.keyboard.press('Enter')
      await stable(page,'Reduced motion confirmation')
    }

    await page.evaluate(()=>scrollTo(0,0))
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    const materials=await page.evaluate(()=>({panel:getComputedStyle(document.querySelector('.daily-list')).backgroundImage,shadow:getComputedStyle(document.querySelector('.daily-list')).boxShadow,input:getComputedStyle(document.querySelector('.daily-search input')).boxShadow}))
    assert.match(materials.panel,/grain/,'Paper texture must load as a static background, not an animated filter')
    assert.match(materials.shadow,/inset/)
    assert.match(materials.input,/inset/)
    await page.screenshot({path:`${output}/jornada-${width}-${theme}.png`,fullPage:true})
    if(width!==320) for(const name of ['Semana','Clientes','Informes']) {
      await navigate(page,name)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width}/${theme}: horizontal overflow`)
      await page.screenshot({path:`${output}/${name.toLowerCase()}-${width}-${theme}.png`,fullPage:true})
    }
    if(width===1440&&theme==='light') {
      await navigate(page,'Mi jornada')
      const meta=page.getByRole('region',{name:'Revisiones Meta Ads',exact:true})
      const google=page.getByRole('region',{name:'Revisiones Google Ads',exact:true})
      await meta.getByRole('button',{name:'Revisado sin cambios: TIENDA',exact:true}).click()
      assert.equal(await google.getByRole('button',{name:'Registrar acciones: TIENDA',exact:true}).count(),1,'Meta confirmation must leave Google pending')
      await google.getByRole('button',{name:'Registrar acciones: TIENDA',exact:true}).click()
      await page.locator('.rapid-review button[data-action-type-id="google.keyword.updated"]').click()
      await page.locator('.rapid-details summary').click()
      await page.getByLabel('Observaciones',{exact:true}).fill('SOLO GOOGLE')
      await page.locator('.rapid-save-bar .save-button').click()
      await page.locator('.rapid-review').waitFor({state:'detached'})
      await page.waitForTimeout(400)
      assert.equal([...rows.values()].filter(row=>row.kind==='review'&&row.payload.clientId==='c'&&!row.deleted).length,2)
      await navigate(page,'Semana')
      assert.equal(await page.getByRole('region',{name:'Semana Google Ads',exact:true}).locator('.week-table button.reviewed').count(),1)
      await navigate(page,'Clientes')
      const bindings=structuredClone(rows.get('client:c').payload.advertisingAccounts)
      await page.getByRole('region',{name:'Clientes Meta Ads',exact:true}).getByRole('button',{name:'Archivar TIENDA',exact:true}).click()
      await page.waitForTimeout(400)
      assert.deepEqual(rows.get('client:c').payload.advertisingAccounts,bindings)
      assert.deepEqual(rows.get('client:c').payload.archivedPlatforms,['meta_ads'])
      assert.equal(await page.getByRole('region',{name:'Clientes Google Ads',exact:true}).getByRole('button',{name:'Archivar TIENDA',exact:true}).count(),1)
      assert.equal(await page.getByRole('button',{name:'Conectar Companion',exact:true}).count(),0,'Companion setup must not live on Clients')
      await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).click()
      await page.getByRole('button',{name:'Conectar Companion',exact:true}).click()
      await page.getByRole('region',{name:'Conectar Companion en la PC',exact:true}).waitFor()
      const order=await page.locator('.workspace-controls').evaluate(element=>[...element.children].slice(0,3).map(child=>child.className))
      assert.deepEqual(order,['db-status','theme-toggle','account-trigger'])
      await page.keyboard.press('Escape')
      await navigate(page,'Informes')
      const line=page.locator('.report-preview-wrap .notebook-report tbody tr').filter({hasText:'TIENDA'})
      assert.match(await line.textContent(),/Google Ads/);assert.doesNotMatch(await line.textContent(),/Meta Ads/)
      const period=await page.locator('.report-period').boundingBox(),controls=await page.locator('.report-controls').boundingBox()
      assert.ok(period.width<controls.width-30,'Two period buttons must not stretch across their container')
      const beforeSync=writes
      await page.getByRole('button',{name:'Sincronizar con DB',exact:true}).click()
      await page.getByText('Estado sincronizado con la DB. Disponible en tus otros navegadores.',{exact:true}).waitFor()
      assert.equal(writes,beforeSync,'Manual sync must not upload a duplicate snapshot or unchanged records')
      await page.getByRole('button',{name:/^Detallado/}).click()
      await page.locator('.detail-preview-pages .report-detail').first().waitFor()
      const details=await page.locator('.report-preview-wrap').textContent()
      assert.match(details,/SOLO GOOGLE/)
      await page.evaluate(()=>localStorage.clear())
      await page.reload()
      await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
      const restored=page.getByRole('region',{name:'Revisiones Google Ads',exact:true})
      await restored.getByRole('button',{name:'Editar revisión: TIENDA',exact:true}).waitFor()
      assert.equal(await page.getByRole('region',{name:'Revisiones Meta Ads',exact:true}).locator('.review-item[data-client-id="c"]').count(),0)
      console.log('Independent review/archive per platform, unified filtered exports, DB-only reload, no-op sync, compact period and account-menu Companion passed')
    }
    await context.close()
    console.log(`${width}px ${theme}: stable confirmation/undo/open/close/save, preserved focus, no duplicate writes, tactile surfaces and no overflow`)
  }
  assert.deepEqual(errors,[])
} catch(error) {
  if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{})
  throw error
} finally { await browser.close() }
