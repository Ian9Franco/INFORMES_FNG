'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, Download, X } from 'lucide-react'
import type { SyncView } from '../sync/engine'
import { recordKey, type Change } from '../sync/records'
import { describeReviewActions } from '../review-actions'
import { serviceLabel, type WorkService, WORK_SERVICES } from '../work-services'

function changeLabel(change: Change, view: SyncView) {
  const client = view.store.clients.find(item => item.id === change.payload.clientId)
  const service = change.payload.service ?? change.payload.platform
  const scope = typeof service === 'string' && WORK_SERVICES.includes(service as WorkService) ? serviceLabel(service as WorkService) : ''
  return [client?.name ?? (change.kind === 'review' ? 'Revisión de cliente' : String(change.payload.name ?? change.payload.label ?? change.kind)), scope, typeof change.payload.date === 'string' ? change.payload.date.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ')
}

export default function SyncResolutionPanel({ open, onClose, view, onResolve }: { open: boolean; onClose: () => void; view: SyncView; onResolve: (key: string, keepLocal: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const problems = [...new Map([...view.conflicts, ...view.rejected].map(change => [recordKey(change),change])).values()]
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close() }, [open])
  function resolve(change: Change, keepLocal: boolean) {
    setError('')
    try { onResolve(recordKey(change),keepLocal) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo resolver. Tu versión sigue guardada.') }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), pendingChanges: problems },null,2)], {type:'application/json'}))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Informes FNG - cambios pendientes ${new Date().toISOString().slice(0,10)}.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url),1000); setDownloaded(true)
  }
  return <dialog ref={ref} className="sync-resolution screen" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const bounds=event.currentTarget.getBoundingClientRect(); if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)onClose() } }}>
    <header><div><small>SINCRONIZACIÓN</small><h2 id={title}>Revisar cambios</h2></div><button type="button" className="icon-button" aria-label="Cerrar revisión de cambios" onClick={onClose}><X size={18} /></button></header>
    <div className="sync-resolution-body">
      {problems.length ? <><p>{problems.length} {problems.length === 1 ? 'registro necesita' : 'registros necesitan'} una decisión. No borramos tu versión automáticamente.</p><button type="button" className="secondary-button" onClick={backup}><Download size={16} />Descargar copia local</button><p className="sync-backup-help">{downloaded ? 'Copia descargada. ' : ''}Descargar el informe o una copia no resuelve la sincronización: elegí qué conservar.</p>
        {view.rejected.length && view.message ? <p className="sync-validation-message">{view.message}</p> : null}
        <div className="sync-problem-list">{problems.map(change => {
          const rejected = view.rejected.some(item => recordKey(item) === recordKey(change))
          return <details key={recordKey(change)} className="sync-problem"><summary>{changeLabel(change,view)}<span>{rejected ? 'No aceptado por la DB' : 'Versiones distintas'}</span></summary><p>{rejected ? 'La DB rechazó este cambio; no significa que otro dispositivo lo haya editado.' : 'La copia local y la nube son distintas. Elegir la nube quita sólo este cambio pendiente del dispositivo.'}</p><p className="sync-local-content"><strong>Tu copia local</strong>{change.deleted ? 'Quitar registro' : change.kind === 'review' ? [describeReviewActions({actions:String(change.payload.actions ?? ''),actionEntries:change.payload.actionEntries as Parameters<typeof describeReviewActions>[0]['actionEntries']}),String(change.payload.observations ?? '')].filter(Boolean).join('\n') || 'Revisado sin cambios' : String(change.payload.text ?? change.payload.label ?? change.payload.name ?? 'Cambio de configuración')}</p><div className="sync-problem-actions"><button type="button" className="secondary-button" onClick={() => resolve(change,false)}>{rejected ? 'Usar nube / quitar este pendiente' : 'Usar versión de la nube'}</button><button type="button" className="primary-button" onClick={() => resolve(change,true)}>{rejected ? 'Reintentar mi cambio' : 'Conservar mi versión'}</button></div></details>
        })}</div>
      </> : <div className="sync-resolution-empty" role="status"><Check size={24} /><h3>No quedan cambios por revisar</h3><p>Los cambios aceptados se enviarán por la sincronización habitual.</p></div>}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <footer><button type="button" className="secondary-button" onClick={onClose}>Volver a mi libreta</button></footer>
  </dialog>
}
