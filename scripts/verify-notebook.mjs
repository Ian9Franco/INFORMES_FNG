// Usage: node scripts/verify-notebook.mjs URL PLAYWRIGHT_MODULE CHROME_PATH OUTPUT_DIR
// Runs in an isolated browser profile; never uses the user's local storage or session.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
const [url, playwrightModule, chromePath, output] = process.argv.slice(2)
if (!url || !playwrightModule || !chromePath || !output) throw new Error('Missing verification arguments')
const { chromium } = require(playwrightModule)
const { PDFDocument } = require(path.join(path.dirname(playwrightModule), 'pdf-lib'))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, colorScheme: 'light', acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))

async function navigate(label, heading) {
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('heading', { name: heading, exact: true }).waitFor()
  await page.locator('.notebook-page').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).evaluate(element => new Promise(resolve => {
    let frames = 0
    const check = () => {
      const style = getComputedStyle(element)
      if (Number(style.opacity) > .999 && (style.transform === 'none' || style.transform === 'matrix(1, 0, 0, 1, 0, 0)')) resolve()
      else if (++frames > 180) resolve()
      else requestAnimationFrame(check)
    }
    check()
  }))
}

try {
  await page.goto(url)
  await page.getByRole('heading', { name: 'Mi jornada', exact: true }).waitFor()
  assert.equal(await page.locator('.wordmark strong').textContent(), 'Informes FNG')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('informes-fng-v1')))
  assert.equal(stored.clients.flatMap(client => client.advertisingAccounts ?? []).length, 34)
  console.log(`Loaded ${stored.clients.length} clients, 34 accounts; catalogue persisted`)
  await navigate('Clientes', 'Clientes')
  await page.getByLabel('Nombre', { exact: true }).fill('CUENTA QA')
  assert.equal(await page.getByRole('button', { name: 'Agregar cliente', exact: true }).isDisabled(), true)
  await page.getByLabel('ID de cuenta publicitaria (Meta)', { exact: true }).fill('2980180415592669')
  await page.getByRole('button', { name: 'Agregar cliente', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Esta cuenta publicitaria ya está vinculada' }).waitFor()
  await page.getByLabel('ID de cuenta publicitaria (Meta)', { exact: true }).fill('9876543210123456789')
  await page.getByRole('button', { name: 'Agregar cliente', exact: true }).click()
  const names = await page.locator('.client-identity strong').allTextContents()
  assert.deepEqual(names, [...names].sort(new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true }).compare))
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem('informes-fng-v1')).clients.find(client => client.name === 'CUENTA QA'))
  assert.equal(created.advertisingAccounts[0].accountId, '9876543210123456789')
  await navigate('Mi jornada', 'Mi jornada')
  console.log('New client requires account ID, duplicate account blocked, alphabetical order verified')
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
  await page.reload()
  await page.getByRole('heading', { name: 'Mi jornada', exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.screenshot({ path: path.join(output, 'desktop-dark.png'), fullPage: true })
  await page.getByRole('button', { name: 'Activar tema claro' }).click()
  await page.getByRole('button', { name: 'Registrar revisión', exact: true }).click()
  await page.locator('.client-picker-trigger').click()
  await page.getByRole('combobox').fill('26195611326734794')
  await page.getByRole('combobox').press('Enter')
  assert.match(await page.locator('.client-picker-trigger').textContent(), /OLIVIERI/)
  await page.locator('.client-picker-trigger').click()
  await page.getByRole('combobox').press('Escape')
  assert.equal(await page.locator('dialog').evaluate(dialog => dialog.open), true)
  await page.getByRole('button', { name: 'Añadí anuncios', exact: false }).first().click()
  await page.getByLabel('Otros detalles').fill('Control semanal y ajuste de anuncios.')
  await page.getByLabel('Observaciones', { exact: true }).fill('Seguimiento de conversiones. Continuar revisión de presupuesto.')
  await page.getByRole('button', { name: 'Guardar revisión' }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  const reviews = await page.evaluate(() => JSON.parse(localStorage.getItem('informes-fng-v1')).reviews)
  assert.equal(reviews.length, 1)
  assert.equal(reviews[0].actionEntries[0].typeId, 'meta.ad.created')
  await navigate('Informes', 'Informes')
  const counterTops = await page.locator('.report-summary strong').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top))
  assert.ok(Math.max(...counterTops) - Math.min(...counterTops) < 1, 'Report counters must share the same baseline')
  assert.equal(await page.locator('.site-footer a').first().getAttribute('href'), 'https://ian-pontorno-portfolio.vercel.app')
  assert.equal(await page.locator('.repository-link').getAttribute('href'), 'https://github.com/Ian9Franco/INFORMES_FNG')
  await page.getByLabel('Título del documento').fill('Informe Ian')
  await page.screenshot({ path: path.join(output, 'desktop-report.png'), fullPage: true })

  for (const [button, suffix] of [['Planilla semanal', 'semanal'], ['Informe detallado', 'detallado']]) {
    await page.getByRole('button', { name: button, exact: false }).click()
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click()
    const download = await downloadEvent
    assert.match(download.suggestedFilename(), /^Informe Ian/)
    const imagePath = path.join(output, `${suffix}.png`)
    await download.saveAs(imagePath)
    const png = await readFile(imagePath)
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
    assert.ok(width >= 2475 && height >= 3500, `${suffix}: unexpected PNG dimensions ${width}x${height}`)
    const pdf = await page.pdf({ path: path.join(output, `${suffix}.pdf`), preferCSSPageSize: true, printBackground: true })
    const document = await PDFDocument.load(pdf)
    assert.equal(document.getPageCount(), 1, `${suffix}: PDF must be exactly one page`)
    console.log(`${suffix}: ${width}x${height} PNG and single-page PDF`)
  }
  await page.getByLabel('Título del documento').fill('Reporte personalizado')
  assert.equal(await page.locator('.print-paper h1').textContent(), 'Reporte personalizado')
  await page.reload()
  await page.getByRole('heading', { name: 'Mi jornada', exact: true }).waitFor()
  await navigate('Informes', 'Informes')
  assert.equal(await page.getByLabel('Título del documento').inputValue(), 'Reporte personalizado')

  await page.setViewportSize({ width: 390, height: 844 })
  await navigate('Mi jornada', 'Mi jornada')
  await page.screenshot({ path: path.join(output, 'mobile-light.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile horizontal overflow')
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
  await page.getByRole('button', { name: 'Registrar revisión', exact: true }).click()
  await page.locator('.client-picker-trigger').click()
  await page.getByRole('combobox').fill('JONDE')
  await page.locator('.client-picker-menu').evaluate(element => new Promise(resolve => {
    const check = () => Number(getComputedStyle(element).opacity) >= .999 ? resolve() : requestAnimationFrame(check)
    check()
  }))
  await page.screenshot({ path: path.join(output, 'mobile-picker-dark.png'), fullPage: true })
  await page.getByRole('combobox').press('Escape')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.locator('dialog').waitFor({ state: 'detached' })
  // Dense fixture: verify the one-sheet promise with enough text to require reflow.
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('informes-fng-v1'))
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    now.setDate(now.getDate() - (now.getDay() + 6) % 7)
    store.reviews = store.clients.flatMap((client, clientIndex) => Array.from({ length: 6 }, (_, dayIndex) => {
      const day = new Date(now)
      day.setDate(day.getDate() + dayIndex)
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      return { id: `stress-${clientIndex}-${dayIndex}`, clientId: client.id, date, createdAt: day.toISOString(), actions: 'Se revisaron anuncios, grupos y campañas. '.repeat(4), observations: 'Se mantiene el seguimiento semanal de conversiones y presupuesto. '.repeat(4) }
    }))
    localStorage.setItem('informes-fng-v1', JSON.stringify(store))
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Mi jornada', exact: true }).waitFor()
  await navigate('Informes', 'Informes')
  await page.getByRole('button', { name: 'Informe detallado', exact: false }).click()
  const fit = await page.locator('.print-paper .report-body').evaluate(area => {
    const last = area.querySelector('.report-content > section:last-child')
    return last.getBoundingClientRect().bottom <= area.getBoundingClientRect().bottom + 1
  })
  assert.equal(fit, true, 'Dense report content must fit without clipping')
  const densePdf = await page.pdf({ path: path.join(output, 'dense-single-page.pdf'), preferCSSPageSize: true, printBackground: true })
  assert.equal((await PDFDocument.load(densePdf)).getPageCount(), 1)
  console.log('Dense report: all text fits within one page, with no clipping')
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('Theme persistence, transitions, keyboard selector, saved actions, title persistence and mobile layout passed')
} finally { await browser.close() }
