// Isolated browser/Auth/REST/Realtime simulation. Never uses real sessions or database writes.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const require=createRequire(import.meta.url)
const [url,modulePath,chrome,output]=process.argv.slice(2)
const {chromium}=require(modulePath)
const uid='00000000-0000-4000-8000-000000000111'
const user={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{}}
const jwt=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.signature`
const names=['URBANO','ALAMEDA RESTAURANTE','ROKER','GENERIA','JOKER','JONDE','HOUSTON ARG','IMEK','CAUCE','WWSS','ROGOLINO GHEZZI','AZAHARES','TOLENTINOS','PUERTO CRISTAL','DA MILÁN','ELECTRIC HOGAR','CASA VELTRI']
const rows=new Map(names.map((name,index)=>[`client:${name}`,{user_id:uid,kind:'client',id:name,payload:{id:name,name,active:name!=='URBANO',advertisingAccounts:[{platform:'google_ads',accountId:String(9000000000+index),owner:name},...(name==='JONDE'?[{platform:'meta_ads',accountId:'9000000000000001',owner:'Hotel de prueba'}]:[])]},version:1,deleted:false}]))
rows.set('settings:workspace',{user_id:uid,kind:'settings',id:'workspace',payload:{accountCatalogVersion:1},version:1,deleted:false})
const errors=[],writes=[]
const browser=await chromium.launch({executablePath:chrome,headless:true})
let debugPage
try {
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  await context.addInitScript(({jwt,user})=>localStorage.setItem('sb-zxhxerhksohymmyofvqb-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})),{jwt,user})
  await context.route('**/auth/v1/**',route=>route.fulfill({json:user}))
  await context.route('**/rest/v1/**',async route=>{
    const request=route.request(),parsed=new URL(request.url())
    if(parsed.pathname.endsWith('/rpc/fng_apply_changes')) {
      const {changes}=request.postDataJSON();writes.push(...changes)
      const updated=changes.map(change=>({...change,user_id:uid,version:(rows.get(`${change.kind}:${change.id}`)?.version??0)+1,deleted:change.deleted??false}))
      updated.forEach(row=>rows.set(`${row.kind}:${row.id}`,row))
      return route.fulfill({json:updated})
    }
    let selected=[...rows.values()]
    for(const [field,condition] of parsed.searchParams) {
      if(!['kind','id','user_id','review_date'].includes(field))continue
      const [op,...parts]=condition.split('.'),value=parts.join('.')
      selected=selected.filter(row=>op==='eq'?row[field]===value:op==='neq'?row[field]!==value:op==='gte'?row[field]>=value:op==='lt'?row[field]<value:op==='in'?value.replace(/[()]/g,'').split(',').includes(row[field]):true)
    }
    return route.fulfill({json:selected})
  })
  const page=await context.newPage()
  debugPage=page
  page.on('pageerror',error=>errors.push(error.message))
  await page.routeWebSocket('**/realtime/v1/**',ws=>ws.onMessage(message=>{const [joinRef,ref,topic,event,payload]=JSON.parse(String(message));if(event==='phx_join')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]));if(event==='heartbeat')ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))}))
  await page.goto(url)
  await page.getByRole('heading',{name:'Mi jornada',exact:true}).waitFor()
  await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  assert.equal(rows.get('settings:workspace').payload.accountCatalogVersion,1)
  const clients=[...rows.values()].filter(row=>row.kind==='client')
  assert.equal(clients.length,17,'Migration must not duplicate existing clients')
  assert.equal(clients.flatMap(row=>row.payload.advertisingAccounts??[]).filter(account=>account.platform==='google_ads').length,17)
  assert.equal(rows.get('client:URBANO').payload.active,false,'Archived state survives upgrade')
  assert.equal(writes.length,0,'No bundled catalog may bootstrap or overwrite the database')
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'Clientes',exact:true}).click()
  await page.getByRole('heading',{name:'Clientes',exact:true}).waitFor()
  await page.waitForFunction(()=>{const page=document.querySelector('.notebook-page[data-page="clientes"]');if(!page)return false;const style=getComputedStyle(page);return Number(style.opacity)>.999&&(style.transform==='none'||style.transform==='matrix(1, 0, 0, 1, 0, 0)')})
  const jonde=page.locator('.client-management-row').filter({hasText:'JONDE'})
  await jonde.getByRole('button',{name:'Google Ads · 900-000-0005',exact:true}).waitFor()
  await jonde.getByRole('button',{name:'Meta · 9000000000000001',exact:true}).waitFor()
  await mkdir(output,{recursive:true})
  await page.screenshot({path:`${output}/google-clients-desktop.png`,fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await page.waitForTimeout(150)
  await jonde.scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.screenshot({path:`${output}/google-clients-mobile.png`})
  await page.reload()
  await page.getByRole('heading',{name:'Mi jornada',exact:true}).waitFor()
  await page.getByRole('button',{name:'Mi cuenta · DB activa',exact:true}).waitFor()
  await page.waitForTimeout(600)
  assert.equal(writes.length,0,'Reloading cannot create or mutate managed clients')
  assert.equal(await page.getByRole('button',{name:'Agregar cliente',exact:true}).count(),0)
  assert.deepEqual(errors,[])
  console.log('Private DB catalog: 17 Google bindings, no bundled seed or automatic writes, archived state preserved and responsive Meta/Google labels')
} catch(error) {
  console.log({writes:writes.length,errors,status:await debugPage?.locator('.account-trigger').textContent(),outbox:await debugPage?.evaluate(()=>JSON.parse(localStorage.getItem('fng-outbox:00000000-0000-4000-8000-000000000111')??'[]').length)})
  await mkdir(output,{recursive:true})
  await debugPage?.screenshot({path:`${output}/failure.png`,fullPage:true})
  console.log(await debugPage?.evaluate(()=>[...document.querySelectorAll('main *')].filter(element=>element.getBoundingClientRect().right>innerWidth+1).slice(0,6).map(element=>({class:element.className,width:element.getBoundingClientRect().width}))))
  throw error
} finally {await browser.close()}
