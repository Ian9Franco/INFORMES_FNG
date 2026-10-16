'use client'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { date, format, type Store, weekDays } from '../data'
import { sortClients } from '../clients'
import { monthBounds } from '../sync/records'
import { compactReviewText, paginateDetail, type DetailBlock, type DetailPage } from '../report-layout'
import { serviceLabel } from '../work-services'

function ClientBlock({ block }: { block: DetailBlock }) {
  return <section className="detail-client" data-detail-block={block.id}><h2>{block.title}{block.continued ? <small> · continuación</small> : null}</h2>{block.items.map(item => <article key={item.id} data-detail-item={item.id}>{item.date ? <b className="detail-date">{item.date}{item.continued ? <small>cont.</small> : null}</b> : null}<p>{item.text}</p></article>)}</section>
}

export default function DetailedNotebookReport({ store, week, month, title, preview = false }: { store: Store; week: string; month?: string; title: string; preview?: boolean }) {
  const frame = useRef<HTMLDivElement>(null)
  const template = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pages, setPages] = useState<DetailPage[]>([{ columns: [[], []] }])
  const [failure, setFailure] = useState('')
  const days = weekDays(week)
  const bounds = month ? monthBounds(month) : undefined
  const entries = store.reviews.filter(review => bounds ? review.date >= bounds.start && review.date < bounds.end : days.includes(review.date))
  const period = month ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date(`${month}-01`)) : `${format(days[0])} al ${format(days[5])} de ${date(days[5]).getFullYear()}`
  const summary = `${entries.length} revisiones · ${new Set(entries.map(review => review.clientId)).size} clientes`
  const blocks = useMemo<DetailBlock[]>(() => {
    const range = month ? monthBounds(month) : undefined
    const weekDates = weekDays(week)
    const result = sortClients(store.clients).flatMap(client => {
      const reviews = store.reviews.filter(review => review.clientId === client.id && (range ? review.date >= range.start && review.date < range.end : weekDates.includes(review.date))).sort((a, b) => a.date.localeCompare(b.date))
      return reviews.length ? [{ id: client.id, title: client.name, items: reviews.map(review => ({ id: review.id, date: `${review.date.slice(8, 10)}/${review.date.slice(5, 7)}`, text: compactReviewText(review) })) }] : []
    })
    const pending = store.pending.filter(item => !item.resolved)
    if (pending.length) result.push({ id: '__pending', title: 'Pendientes abiertos', items: pending.map(item => ({ id: item.id, date: '', text: `${store.clients.find(client => client.id === item.clientId)?.name ?? 'Cliente archivado'} · ${item.service || item.platform ? `${serviceLabel(item.service ?? item.platform!)} · ` : ''}${item.text}` })) })
    if (!result.length) result.push({ id: '__empty', title: 'Sin registros', items: [{ id: '__empty', date: '', text: 'Este período todavía no tiene revisiones registradas.' }] })
    return result
  }, [store, week, month])

  useLayoutEffect(() => {
    const resize = () => {
      const root = template.current
      const column = root?.querySelector<HTMLElement>('.detail-column')
      const host = root?.querySelector<HTMLElement>('.detail-measure-host')
      if (!root || !column || !host || column.clientHeight < 100) return
      if (preview && frame.current) setScale(Math.min(1, frame.current.clientWidth / root.offsetWidth))
      const cache = new Map<string, number>()
      const measure = (block: DetailBlock) => {
        const key = JSON.stringify(block)
        if (cache.has(key)) return cache.get(key)!
        const source = root.querySelector<HTMLElement>('.detail-measure-source')?.querySelector<HTMLElement>(`[data-detail-block="${CSS.escape(block.id)}"]`)
        if (!source) throw Error('No se pudo medir el contenido del informe.')
        const section = source.cloneNode(false) as HTMLElement
        const heading = source.querySelector('h2')!.cloneNode(true) as HTMLElement
        heading.textContent = block.title
        if (block.continued) { const label = document.createElement('small'); label.textContent = ' · continuación'; heading.append(label) }
        section.append(heading)
        for (const item of block.items) {
          const originalId = item.id.replace(/:part:\d+$/, '')
          const original = source.querySelector<HTMLElement>(`[data-detail-item="${CSS.escape(originalId)}"]`)!
          const article = original.cloneNode(true) as HTMLElement
          article.querySelector('p')!.textContent = item.text
          if (item.continued && item.date) { const label = document.createElement('small'); label.textContent = 'cont.'; article.querySelector('b')!.append(label) }
          section.append(article)
        }
        host.replaceChildren(section)
        // Preview squash transforms must never alter physical A4 pagination.
        const height = parseFloat(getComputedStyle(section).height)
        cache.set(key, height)
        return height
      }
      try {
        const gap = parseFloat(getComputedStyle(column).rowGap) || 0
        const next = paginateDetail(blocks, column.clientHeight - 1, gap, measure)
        setPages(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
        setFailure('')
      } catch (error) { setFailure(error instanceof Error ? error.message : 'No se pudo distribuir el informe.') }
      finally { host.replaceChildren() }
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (template.current) observer.observe(template.current)
    if (frame.current) observer.observe(frame.current)
    let alive = true
    void document.fonts.ready.then(() => { if (alive) resize() })
    window.addEventListener('beforeprint', resize)
    return () => { alive = false; observer.disconnect(); window.removeEventListener('beforeprint', resize) }
  }, [blocks, title, period, summary, preview])

  function header() {
    return <header><div><span className="report-overline">LIBRETA DE SEGUIMIENTO</span><h1>{title}</h1><p>Publicidad · detalle {month ? 'mensual' : 'semanal'}</p></div><div><small>{month ? 'MES' : 'SEMANA'}</small><strong>{period}</strong><p className="detail-summary">{summary}</p></div></header>
  }
  function footer(index: number) { return <footer><span>{title} · seguimiento publicitario</span><span>{new Date().toLocaleDateString('es-AR')} · {index + 1} / {pages.length}</span></footer> }
  const measureSheet = <div className="detail-measure" aria-hidden="true" inert><div ref={template} className="notebook-report report-detail">{header()}<div className="report-body detail-columns"><div className="detail-column"><div className="detail-measure-host" /></div><div className="detail-column" /></div>{footer(0)}<div className="detail-measure-source">{blocks.map(block => <ClientBlock key={block.id} block={block} />)}</div></div></div>
  const sheets = pages.map((page, index) => <div className="notebook-report report-detail" data-export-page={index + 1} key={index}>{header()}<div className="report-body report-content detail-columns">{page.columns.map((column, side) => <div className="detail-column" key={side}>{column.map(block => <ClientBlock key={block.id} block={block} />)}</div>)}</div>{footer(index)}</div>)
  if (!preview) return <div className="print-paper" aria-hidden="true" data-layout-ready={!failure && pages[0].columns[0].length > 0}>{measureSheet}{sheets}</div>
  return <section className="report-preview-wrap" data-layout-ready={!failure && pages[0].columns[0].length > 0}>
    {measureSheet}<div className="preview-label"><span>Vista previa · {title}</span><span>A4 · {pages.length} {pages.length === 1 ? 'hoja' : 'hojas'} · 2 columnas</span></div>
    <div ref={frame} className="detail-preview-pages">{sheets.map((sheet, index) => <div className="notebook-preview-frame" key={index} style={{ height: `calc(297mm * ${scale})` }}><div className="notebook-preview-scale" style={{ transform: `scale(${scale})` }}>{sheet}</div></div>)}</div>
    <p className="report-fit-note" role={failure ? 'alert' : undefined}>{failure || 'Texto de 10,5 pt, sin reducción automática. Se agregan hojas sólo cuando hace falta. El PNG incluye todas las hojas en una imagen vertical.'}</p>
  </section>
}
