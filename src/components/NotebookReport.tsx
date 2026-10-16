'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { date, format, type Store, weekDays } from '../data'
import { sortClients } from '../clients'
import { monthBounds } from '../sync/records'
import { issueCellText, conditionMark } from '../review-issues'
import { simpleActionSummary, simpleActionLegend } from '../simple-report'

import DetailedNotebookReport from './DetailedNotebookReport'

const weekdays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

type Props = { store: Store; week: string; month?: string; mode: 'grilla' | 'detalle'; title: string; preview?: boolean }
export default function NotebookReport(props: Props) {
  return props.mode === 'detalle' ? <DetailedNotebookReport {...props} /> : <GridReport {...props} />
}

/** The summary grid remains a single physical A4 sheet. */
function GridReport({ store, week, month, mode, title, preview = false }: { store: Store; week: string; month?: string; mode: 'grilla' | 'detalle'; title: string; preview?: boolean }) {
  const sheet = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [contentScale, setContentScale] = useState(1)
  const days = weekDays(week)
  const clients = sortClients(store.clients)
  const active = clients.filter(client => client.active)
  const bounds = month ? monthBounds(month) : undefined
  const entries = store.reviews.filter(review => bounds ? review.date >= bounds.start && review.date < bounds.end : days.includes(review.date))
  const legend = simpleActionLegend(entries)
  const pending = store.pending.filter(item => !item.resolved)
  const weekLabel = month ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date(`${month}-01`)) : `${format(days[0])} al ${format(days[5])} de ${date(days[5]).getFullYear()}`

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
  }, [store, week, month, mode, title, preview])

  const paper = <div ref={sheet} data-export-page="1" className={`notebook-report ${mode === 'detalle' ? 'report-detail' : 'report-grid'} ${month ? 'is-monthly' : 'is-weekly'}`}>
    <header><div><span className="report-overline">LIBRETA DE SEGUIMIENTO</span><h1>{title}</h1><p>Publicidad · registro {month ? 'mensual' : 'semanal'}</p></div><div><small>{month ? 'MES' : 'SEMANA'}</small><strong>{weekLabel}</strong></div></header>
    <div className="report-body" ref={area}><div className="report-content" ref={content}>
      <p className="simple-action-legend" aria-label="Guía de abreviaturas"><strong>Guía rápida · </strong>{legend}</p>
      {month ? <table><thead><tr><th>CLIENTE</th><th title="Revisiones">REV.</th><th>ACCIONES</th><th>ÚLTIMA REVISIÓN</th></tr></thead><tbody>{clients.filter(client => client.active || entries.some(review => review.clientId === client.id)).map(client => {
        const reviews = entries.filter(review => review.clientId === client.id).sort((a,b) => a.date.localeCompare(b.date))
        const summary = simpleActionSummary(reviews,true)
        const mark = conditionMark(reviews)
        return <tr key={client.id}><td>{client.name}</td><td>{reviews.length}</td><td className="simple-period-actions">{summary.join(' / ') || '—'}{issueCellText(reviews) ? <small className={`report-issue ${mark === 'P' ? 'is-client-paused' : ''}`}>{mark} {issueCellText(reviews)}</small> : null}{reviews.some(review => review.actions.trim()) ? <small className="simple-action-line">Notas en el detallado</small> : null}</td><td>{reviews.length ? format(reviews[reviews.length - 1].date) : '—'}</td></tr>
      })}</tbody></table> : <table><thead><tr><th>CLIENTE</th>{days.map((day, index) => <th key={day}>{weekdays[index]}<small>{day.slice(8)}</small></th>)}<th>ACCIONES DE LA SEMANA</th></tr></thead><tbody>{active.map(client => {
        const clientReviews = entries.filter(review => review.clientId === client.id)
        const summary = simpleActionSummary(clientReviews,true)
        const mark = conditionMark(clientReviews)
        return <tr key={client.id}><td>{client.name}</td>{days.map(day => {
          const reviews = clientReviews.filter(review => review.date === day)
          return <td key={day}>{conditionMark(reviews) || (reviews.length ? '✓' : '·')}</td>
        })}<td className="simple-period-actions">{summary.join(' / ') || '—'}{issueCellText(clientReviews) ? <small className={`report-issue ${mark === 'P' ? 'is-client-paused' : ''}`}>{mark} {issueCellText(clientReviews)}</small> : null}{clientReviews.some(review => review.actions.trim()) ? <small className="simple-action-line">Notas en el detallado</small> : null}</td></tr>
      })}</tbody></table>}
    </div></div>
    <footer><span>{title} · seguimiento publicitario</span><span>{new Date().toLocaleDateString('es-AR')} · 1 / 1</span></footer>
  </div>

  if (!preview) return <div className="print-paper" aria-hidden="true">{paper}</div>
  return <section className="report-preview-wrap"><div className="preview-label"><span>Vista previa · {title}</span><span>A4 · una hoja</span></div><div ref={frame} className="notebook-preview-frame" style={{ height: `calc(297mm * ${previewScale})` }}><div className="notebook-preview-scale" style={{ transform: `scale(${previewScale})` }}>{paper}</div></div>{contentScale < .98 ? <p className="report-fit-note">Todo el contenido se ajustó al {Math.round(contentScale * 100)}% para entrar en una hoja.</p> : null}</section>
}
