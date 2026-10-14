'use client'

import { useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { authFeedback, passwordValidation } from '../lib/auth-feedback'

export default function AccountPasswordForm({ onSaved }: { onSaved?: () => void }) {
  const id = useId()
  const submitting = useRef(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || !supabase) return
    const invalid = passwordValidation(password, confirmation)
    if (invalid) { setMessage(invalid); return }
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      setPassword('')
      setConfirmation('')
      if (error) setMessage(authFeedback(error))
      else {
        setMessage('Contraseña guardada. Usala con tu correo en Informes y Companion; el ingreso no envía correos.')
        onSaved?.()
      }
    } catch {
      setPassword(''); setConfirmation('')
      setMessage('No se pudo guardar. Revisá tu conexión y volvé a intentar.')
    } finally { submitting.current = false; setBusy(false) }
  }

  return <form className="account-password-form" onSubmit={save} aria-busy={busy}>
    <p id={`${id}-help`}>Elegila vos o usá la sugerencia de tu gestor de contraseñas. Mínimo 12 caracteres. No es la contraseña de tu correo y no se envía por email.</p>
    <label htmlFor={`${id}-password`}>Nueva contraseña</label>
    <input id={`${id}-password`} type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby={`${id}-help`} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
    <label htmlFor={`${id}-confirmation`}>Repetir contraseña</label>
    <input id={`${id}-confirmation`} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
    <button type="submit" className="secondary-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    {message ? <p role="status">{message}</p> : null}
  </form>
}
