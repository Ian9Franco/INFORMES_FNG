'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { date, format, type Store, weekDays } from '../data'
import { describeReviewActions } from '../review-actions'
import { sortClients } from '../clients'

const weekdays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

/** Identical physical sheet for preview and printing; all content fits without clipping. */
export default function NotebookReport({ store, week, mode, title, preview = false }: { store: Store; week: string; mode: 'grilla' | 'detalle'; title: string; preview?: boolean }) {
  const sheet = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [contentScale, setContentScale] = useState(1)
  const days = weekDays(week)
  const clients = sortClients(store.clients)
  const active = clients.filter(client => client.active)
  const entries = store.reviews.filter(review => days.includes(review.date))
  const pending = store.pending.filter(item => !item.resolved)
  const weekLabel = `${format(days[0])} al ${format(days[5])} de ${date(days[5]).getFullYear()}`

  useLayoutEffect(() => {
    const resize = () => {
      if (!sheet.current || !area.current || !content.current) return
      const available = area.current.clientHeight
      let fit = 1
      content.current.style.width = '100%'
      // Widen the source as it scales so the final text still uses the full page width.
      // Reflow only reduces the scale, avoiding oscillation with long observations.
      for (let attempt = 0; attempt < 6; attempt++) {
        const needed = content.current.scrollHeight
        if (!needed || needed * fit <= available - 1) break
        fit *= Math.max(1, available - 1) / (needed * fit)
        content.current.style.width = `${100 / fit}%`
      }
      sheet.current.style.setProperty('--report-content-scale', String(fit))
      setContentScale(fit)
      if (preview && frame.current) setPreviewScale(Math.min(1, frame.current.clientWidth / sheet.current.offsetWidth))
    }
    resize()
    const observer = new ResizeObserver(resize)
    if (area.current) observer.observe(area.current)
    if (frame.current) observer.observe(frame.current)
    window.addEventListener('beforeprint', resize)
    return () => { observer.disconnect(); window.removeEventListener('beforeprint', resize) }
  }, [store, week, mode, title, preview])

  const paper = <div ref={sheet} className={`notebook-report ${mode === 'detalle' ? 'report-detail' : 'report-grid'}`}>
    <header><div><span className="report-overline">LIBRETA DE SEGUIMIENTO</span><h1>{title}</h1><p>Publicidad · registro semanal</p></div><div><small>SEMANA</small><strong>{weekLabel}</strong></div></header>
    <div className="report-body" ref={area}><div className="report-content" ref={content}>
      {mode === 'grilla' ? <table><thead><tr><th>CLIENTE</th>{days.map((day, index) => <th key={day}>{weekdays[index]}<small>{format(day)}</small></th>)}</tr></thead><tbody>{active.map(client => <tr key={client.id}><td>{client.name}</td>{days.map(day => <td key={day}>{store.reviews.some(review => review.clientId === client.id && review.date === day) ? '✓' : '·'}</td>)}</tr>)}</tbody></table> : <>
        <p className="report-intro">{entries.length} revisiones realizadas · {new Set(entries.map(review => review.clientId)).size} clientes</p>
        {clients.map(client => {
          const reviews = entries.filter(review => review.clientId === client.id).sort((a, b) => a.date.localeCompare(b.date))
          return reviews.length ? <section key={client.id}><h2>{client.name}</h2>{reviews.map(review => <article key={review.id}><b>{format(review.date)}</b><div><p><strong>Acciones: </strong>{describeReviewActions(review) || 'Sin modificaciones registradas.'}</p><p><strong>Observaciones: </strong>{review.observations || 'Sin observaciones registradas.'}</p></div></article>)}</section> : null
        })}
        {!entries.length ? <p>Esta semana todavía no tiene revisiones registradas.</p> : null}
        <section><h2>Pendientes abiertos</h2>{pending.length ? pending.map(item => <p key={item.id}><strong>{store.clients.find(client => client.id === item.clientId)?.name}: </strong>{item.text}</p>) : <p>Sin pendientes abiertos.</p>}</section>
      </>}
    </div></div>
    <footer><span>{title} · seguimiento publicitario</span><span>{new Date().toLocaleDateString('es-AR')} · 1 / 1</span></footer>
  </div>

  if (!preview) return <div className="print-paper" aria-hidden="true">{paper}</div>
  return <section className="report-preview-wrap"><div className="preview-label"><span>Vista previa · {title}</span><span>A4 · una hoja</span></div><div ref={frame} className="notebook-preview-frame" style={{ height: `calc(297mm * ${previewScale})` }}><div className="notebook-preview-scale" style={{ transform: `scale(${previewScale})` }}>{paper}</div></div>{contentScale < .98 ? <p className="report-fit-note">Todo el contenido se ajustó al {Math.round(contentScale * 100)}% para entrar en una hoja.</p> : null}</section>
}
