'use client'
import { useId } from 'react'

export default function ReviewDetailsFields({ actions, observations, pendingText, onActions, onObservations, onPending, onAddPending }: { actions: string; observations: string; pendingText: string; onActions: (value: string) => void; onObservations: (value: string) => void; onPending: (value: string) => void; onAddPending: () => void }) {
  const id = useId()
  return <div className="review-detail-fields">
    <label htmlFor={`${id}-actions`}>Otros detalles</label><textarea id={`${id}-actions`} rows={2} value={actions} onChange={event => onActions(event.target.value)} placeholder="Algo más que quieras registrar…" />
    <label htmlFor={`${id}-observations`}>Observaciones</label><textarea id={`${id}-observations`} rows={3} value={observations} onChange={event => onObservations(event.target.value)} placeholder="Qué detectaste y qué conviene seguir…" />
    <div className="pending-entry"><label htmlFor={`${id}-pending`}>Nuevo pendiente</label><div><input id={`${id}-pending`} value={pendingText} onChange={event => onPending(event.target.value)} placeholder="Ej.: revisar CPA el jueves" /><button className="secondary-button" type="button" onClick={onAddPending} disabled={!pendingText.trim()}>Agregar</button></div><small>Al guardar la revisión también se agrega este pendiente.</small></div>
  </div>
}
