'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { Database, KeyRound, LogOut, RefreshCw, UserRound, X } from 'lucide-react'
import type { SyncState } from '../sync/engine'

export default function WorkspaceControls({ email, state, failure, message = '', loading, onRefresh, onPassword, onSignOut }: { email?: string; state: SyncState; failure: string; message?: string; loading: boolean; onRefresh: () => void; onPassword: () => void; onSignOut: () => Promise<void> }) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const healthy = state === 'saved' && !failure
  const label = failure || state === 'offline' || state === 'error' ? 'DB sin conexión' : state === 'conflict' ? 'DB · revisar' : state === 'pending' || loading ? 'DB · sincronizando' : 'DB activa'
  function position() {
    if (!menu.current || !trigger.current) return
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.min(332, innerWidth - 24)
    Object.assign(menu.current.style, { width: `${width}px`, left: `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`, top: `${Math.max(12, Math.min(rect.bottom + 12, innerHeight - menu.current.offsetHeight - 12))}px` })
  }
  function close() { menu.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }) }
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open])
  return <div className="workspace-controls">
    <button ref={trigger} type="button" className="account-trigger" popoverTarget={id} aria-label={`Mi cuenta · ${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={position}><span className="db-status" data-state={healthy ? 'active' : 'attention'}><i />{label}</span><span className="account-avatar"><UserRound size={19} aria-hidden="true" /></span></button>
    <div ref={menu} id={id} popover="auto" className="account-menu screen" role="dialog" aria-label="Mi cuenta y sincronización" onToggle={event => { const visible = event.currentTarget.matches(':popover-open'); setOpen(visible); if (visible) position() }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
      <header><div><small>MI CUENTA</small><strong>{email || 'Sesión iniciada'}</strong></div><button className="icon-button" type="button" aria-label="Cerrar menú de cuenta" onClick={close}><X size={16} /></button></header>
      <section className="account-sync" aria-label="Estado de base de datos"><Database size={19} aria-hidden="true" /><div><strong role="status">{label}</strong><p>{failure || message || (state === 'saved' ? 'Tus cambios están guardados en Supabase.' : state === 'pending' ? 'Guardando los cambios de este dispositivo.' : state === 'conflict' ? 'Hay cambios de otro dispositivo para resolver.' : 'Los cambios pendientes se conservan en este dispositivo.')}</p><small>Este estado es de la DB, no de Companion.</small></div></section>
      <button type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={17} aria-hidden="true" />{loading ? 'Actualizando…' : 'Actualizar datos'}</button>
      <button type="button" onClick={() => { close(); onPassword() }}><KeyRound size={17} aria-hidden="true" />Contraseña de mi cuenta</button>
      <button type="button" disabled={signingOut} onClick={async () => { setSigningOut(true); setError(''); try { await onSignOut() } catch { setError('No se pudo cerrar la sesión. Volvé a intentar.'); setSigningOut(false) } }}><LogOut size={17} aria-hidden="true" />{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  </div>
}
