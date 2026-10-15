'use client'
import { useId, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { AdPlatform, CustomAction } from '../review-actions'

export default function CreateAction({ clientId, platform, catalog, onCreate }: { clientId?: string; platform: AdPlatform; catalog: CustomAction[]; onCreate: (action: CustomAction) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'client' | 'general'>(clientId ? 'client' : 'general')
  const [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  function close() { setOpen(false); setError(''); trigger.current?.focus({ preventScroll: true }) }
  function create() {
    const label = name.trim().replace(/\s+/g, ' ')
    if (label.length < 2) { setError('Escribí un nombre de al menos dos caracteres.'); return }
    if (scope === 'client' && !clientId) { setError('Elegí un cliente primero.'); return }
    if (catalog.some(item => item.platform === platform && item.scope === scope && item.clientId === (scope === 'client' ? clientId : undefined) && item.label.toLocaleLowerCase() === label.toLocaleLowerCase())) { setError('Ya existe una acción con ese nombre y alcance.'); return }
    onCreate({ id: `custom.${crypto.randomUUID()}`, label, platform, scope, ...(scope === 'client' ? { clientId } : {}) })
    setName(''); close()
  }
  return <div className="create-action">
    <button ref={trigger} type="button" className="text-button create-action-trigger" aria-expanded={open} aria-controls={id} onClick={() => open ? close() : setOpen(true)}><Plus size={15} aria-hidden="true" />Crear acción</button>
    {open ? <div id={id} className="create-action-card" role="group" aria-label="Nueva acción personalizada" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); event.stopPropagation(); create() } }}>
      <header><strong>Nueva acción · {platform === 'meta_ads' ? 'Meta' : 'Google'}</strong><button type="button" className="icon-button" aria-label="Cancelar nueva acción" onClick={close}><X size={16} /></button></header>
      <label htmlFor={`${id}-name`}>Nombre de la acción</label><input id={`${id}-name`} autoFocus maxLength={80} placeholder="Ej.: Actualicé el catálogo" value={name} onChange={event => { setName(event.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} />
      <div className="action-scope" role="group" aria-label="Disponible para">{(['client', 'general'] as const).map(option => <button type="button" key={option} disabled={option === 'client' && !clientId} aria-pressed={scope === option} onClick={() => { setScope(option); setError('') }}>{option === 'client' ? 'Sólo este cliente' : 'Todos mis clientes'}</button>)}</div>
      <p id={`${id}-help`}>{scope === 'client' ? 'Sólo aparecerá en las revisiones de este cliente.' : 'Disponible en todos los clientes de tu cuenta.'} Se guarda en tu catálogo; la revisión se confirma aparte.</p>
      {error ? <p className="action-create-error" role="alert">{error}</p> : null}
      <button type="button" className="primary-button" onClick={create}>Crear y seleccionar</button>
    </div> : null}
  </div>
}
