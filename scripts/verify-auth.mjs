// Isolated Auth simulation: never sends mail or changes a production password.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const [url, modulePath, chrome, output] = process.argv.slice(2)
const { chromium } = createRequire(import.meta.url)(modulePath)
const browser = await chromium.launch({ executablePath: chrome, headless: true })
const uid = '00000000-0000-4000-8000-000000000111'
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
const jwt = `${Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub:uid, exp:Math.floor(Date.now()/1000)+3600, aud:'authenticated', role:'authenticated' })).toString('base64url')}.signature`
const session = { access_token:jwt, refresh_token:'mock-refresh', token_type:'bearer', expires_in:3600, user }
const requests = { email:0, password:0, recovery:0, update:0, verify:0 }
const errors = []

async function device() {
  const context = await browser.newContext({ viewport:{width:390,height:844} })
  await context.route('**/*.supabase.co/**', async route => {
    const request=route.request(), address=new URL(request.url())
    if(address.pathname.endsWith('/otp')) { requests.email++; return route.fulfill({status:429,json:{code:'over_email_send_rate_limit',error_code:'over_email_send_rate_limit',message:'Email rate limit exceeded'}}) }
    if(address.pathname.endsWith('/recover')) { requests.recovery++; return route.fulfill({json:{}}) }
    if(address.pathname.endsWith('/verify')) { requests.verify++; return route.fulfill({json:session}) }
    if(address.pathname.endsWith('/token')) {
      requests.password++
      return route.fulfill({status:400,json:{code:'invalid_credentials',error_code:'invalid_credentials',message:'Invalid login credentials'}})
    }
    if(address.pathname.endsWith('/user')) {
      if(request.method()==='PUT') requests.update++
      return route.fulfill({json:user})
    }
    if(address.pathname.endsWith('/fng_records')) {
      const row={user_id:uid,kind:'settings',id:'workspace',payload:{accountCatalogVersion:1},version:1,deleted:false,review_date:null,updated_at:new Date().toISOString()}
      return route.fulfill({json:address.searchParams.get('kind')==='neq.review'?[row]:[]})
    }
    return route.fulfill({json:[]})
  })
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  await page.routeWebSocket('**/realtime/v1/**',ws=>ws.onMessage(message=>{
    const [joinRef,ref,topic,event,payload]=JSON.parse(String(message))
    if(event==='phx_join') ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:(payload.config.postgres_changes??[]).map(item=>({...item,id:1}))}}]))
    if(event==='heartbeat') ws.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))
  }))
  await page.goto(url)
  await page.getByRole('heading',{name:'Informes FNG',exact:true}).waitFor()
  return {context,page}
}

try {
  await mkdir(output,{recursive:true})
  const first=await device()
  await first.page.getByLabel('Correo electrónico',{exact:true}).fill(user.email)
  await first.page.getByLabel('Contraseña',{exact:true}).fill('mock-long-password')
  await first.page.getByRole('button',{name:'Ingresar',exact:true}).click()
  await first.page.getByRole('status').filter({hasText:'Correo o contraseña incorrectos'}).waitFor()
  assert.equal(requests.password,1)
  assert.equal(requests.email,0,'Password login does not send mail')
  await first.page.getByRole('button',{name:'No tengo contraseña · ingresar por correo',exact:true}).click()
  await first.page.getByRole('button',{name:'Enviar enlace de acceso',exact:true}).click()
  await first.page.getByRole('status').filter({hasText:'Se alcanzó el límite de correos'}).waitFor()
  assert.equal(requests.email,1)
  assert.equal(await first.page.locator('form').first().getByRole('button').isDisabled(),true)
  await first.page.locator('form').first().evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  assert.equal(requests.email,1,'Cooldown prevents repeated requests')
  await first.page.screenshot({path:path.join(output,'email-limit-mobile.png'),fullPage:true})

  await first.page.locator('summary').click()
  await first.page.getByLabel('Enlace de acceso recibido',{exact:true}).fill('https://zxhxerhksohymmyofvqb.supabase.co/auth/v1/verify?token=mock-token&type=recovery')
  await first.page.getByRole('button',{name:'Verificar enlace',exact:true}).click()
  const dialog=first.page.getByRole('dialog',{name:'Contraseña de tu cuenta',exact:true})
  await dialog.waitFor()
  await dialog.getByLabel('Nueva contraseña',{exact:true}).fill('mock-long-password')
  await dialog.getByLabel('Repetir contraseña',{exact:true}).fill('mock-other-password')
  await dialog.getByRole('button',{name:'Guardar contraseña',exact:true}).click()
  await dialog.getByRole('status').filter({hasText:'Las contraseñas no coinciden'}).waitFor()
  assert.equal(requests.update,0)
  await dialog.getByLabel('Repetir contraseña',{exact:true}).fill('mock-long-password')
  await dialog.getByRole('button',{name:'Guardar contraseña',exact:true}).click()
  await dialog.getByRole('status').filter({hasText:'Contraseña guardada'}).waitFor()
  assert.equal(requests.update,1)
  assert.equal(requests.email,1,'Password update does not request mail')
  assert.equal(await dialog.getByLabel('Nueva contraseña',{exact:true}).inputValue(),'')
  assert.equal(await first.page.evaluate(()=>Object.values(localStorage).join('').includes('mock-long-password')),false)
  await first.page.screenshot({path:path.join(output,'password-saved-mobile.png'),fullPage:true})
  await dialog.getByRole('button',{name:'Listo, continuar',exact:true}).click()
  await first.page.getByRole('button',{name:'Contraseña de mi cuenta',exact:true}).click()
  await dialog.waitFor()
  await first.page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})

  const second=await device()
  await second.page.getByRole('button',{name:'Olvidé mi contraseña',exact:true}).click()
  await second.page.getByLabel('Correo electrónico',{exact:true}).fill(user.email)
  await second.page.getByRole('button',{name:'Enviar enlace de recuperación',exact:true}).click()
  await second.page.getByRole('status').filter({hasText:'Si el correo corresponde a una cuenta'}).waitFor()
  assert.equal(requests.recovery,1)
  // The real SDK emits PASSWORD_RECOVERY when it processes this callback.
  await second.page.goto(`${url}/#access_token=${jwt}&refresh_token=mock-refresh&expires_in=3600&token_type=bearer&type=recovery`)
  // Same-origin hash navigation alone does not reinitialize the SDK. A real
  // callback comes from the Auth host and loads a fresh document.
  await second.page.reload()
  await second.page.getByRole('dialog',{name:'Contraseña de tu cuenta',exact:true}).waitFor()
  assert.equal(await second.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,requests,errors,scope:'Mock Auth only; no production mail or credentials'}))
} finally { await browser.close() }
