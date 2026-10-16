'use client'
import { useId } from 'react'
import { AlertTriangle, Check, Wallet } from 'lucide-react'
import { ISSUE_TYPES, type ReviewIssue } from '../review-issues'

/** Conditions do not have quantities and never archive a client or imply positive results. */
export default function ReviewIssues({ value, onChange, organic = false }: { value: ReviewIssue[]; onChange: (value: ReviewIssue[]) => void; organic?: boolean }) {
  const id = useId()
  return <section className="review-issues" aria-label="Incidencias de la revisión">
    <div className="issue-heading"><strong>¿Hay algo que impida avanzar?</strong><small>Cuenta como revisado; la incidencia sale en el informe.</small></div>
    <div className="issue-options">{ISSUE_TYPES.filter(option => !organic || option.id !== 'no_budget' || value.some(issue => issue.type === option.id)).map(option => {
      const selected = value.some(issue => issue.type === option.id)
      return <button type="button" key={option.id} aria-pressed={selected} onClick={() => onChange(selected ? value.filter(issue => issue.type !== option.id) : [...value, { type: option.id }])}>{option.id === 'no_budget' ? <Wallet size={16} /> : <AlertTriangle size={16} />}{option.label}{selected ? <Check size={14} /> : null}</button>
    })}</div>
    {value.map(issue => <label className="issue-detail" key={issue.type} htmlFor={`${id}-${issue.type}`}>{issue.type === 'no_budget' ? 'Detalle del presupuesto' : 'Qué error detectaste'}<input id={`${id}-${issue.type}`} maxLength={600} placeholder={issue.type === 'no_budget' ? 'Ej.: saldo agotado; esperando recarga' : 'Ej.: anuncio rechazado o error de acceso'} value={issue.detail ?? ''} onChange={event => onChange(value.map(item => item.type === issue.type ? { ...item, detail: event.target.value } : item))} /></label>)}
    {value.length ? <p>Se mantiene en la próxima revisión hasta que lo desmarques y guardes. No genera un pendiente automáticamente.</p> : null}
  </section>
}
