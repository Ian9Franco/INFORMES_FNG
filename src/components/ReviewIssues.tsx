'use client'
import { useId } from 'react'
import { AlertTriangle, Check, Pause, Wallet } from 'lucide-react'
import { ISSUE_TYPES, type ReviewIssue } from '../review-issues'

const detailFields = {
  no_budget: { label: 'Detalle del presupuesto', placeholder: 'Ej.: saldo agotado; esperando recarga' },
  error: { label: 'Qué error detectaste', placeholder: 'Ej.: anuncio rechazado o error de acceso' },
  client_paused: { label: 'Detalle de la pausa del cliente', placeholder: 'Ej.: pidió pausar la pauta hasta nuevo aviso' },
}

/** Conditions do not have quantities and never archive a client or imply positive results. */
export default function ReviewIssues({ value, onChange, organic = false }: { value: ReviewIssue[]; onChange: (value: ReviewIssue[]) => void; organic?: boolean }) {
  const id = useId()
  return <section className="review-issues" aria-label="Estado e incidencias de la revisión">
    <div className="issue-heading"><strong>Estado de la cuenta</strong><small>Al guardar cuenta como revisado; el estado sale en el informe.</small></div>
    <div className="issue-options">{ISSUE_TYPES.filter(option => !organic || option.id === 'error' || value.some(issue => issue.type === option.id)).map(option => {
      const selected = value.some(issue => issue.type === option.id)
      return <button type="button" key={option.id} className={option.id === 'client_paused' ? 'is-client-paused' : undefined} aria-pressed={selected} onClick={() => onChange(selected ? value.filter(issue => issue.type !== option.id) : [...value, { type: option.id }])}>{option.id === 'no_budget' ? <Wallet size={16} /> : option.id === 'client_paused' ? <Pause size={16} /> : <AlertTriangle size={16} />}{option.label}{selected ? <Check size={14} /> : null}</button>
    })}</div>
    {value.some(issue => issue.type === 'client_paused') ? <p className="client-pause-help">Pausa por decisión del cliente. No es un error ni archiva la cuenta; podés seguir revisándola.</p> : null}
    {value.map(issue => <label className="issue-detail" key={issue.type} htmlFor={`${id}-${issue.type}`}>{detailFields[issue.type].label}<input id={`${id}-${issue.type}`} maxLength={600} placeholder={detailFields[issue.type].placeholder} value={issue.detail ?? ''} onChange={event => onChange(value.map(item => item.type === issue.type ? { ...item, detail: event.target.value } : item))} /></label>)}
    {value.length ? <p>Se mantiene en la próxima revisión hasta que lo desmarques y guardes. No genera un pendiente automáticamente.</p> : null}
  </section>
}
