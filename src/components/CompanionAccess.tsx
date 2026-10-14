'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CompanionAccess() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <details className="panel companion-access"><summary>Conectar Companion en la PC</summary><p>En la extensión ingresá con el mismo correo de esta cuenta. Si entrás a la web por enlace, podés definir aquí una contraseña para el acceso de Companion.</p><form onSubmit={async event => { event.preventDefault(); if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return } setBusy(true); const { error } = await supabase!.auth.updateUser({ password }); setPassword(''); setConfirmation(''); setBusy(false); setMessage(error ? error.message : 'Contraseña definida. Usala con tu correo en Companion.'); }}><label>Contraseña para tu cuenta<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => setPassword(event.target.value)} /></label><label>Repetir contraseña<input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><button className="secondary-button" disabled={busy}>{busy ? 'Guardando…' : 'Definir contraseña'}</button></form>{message ? <p role="status">{message}</p> : null}</details>
}
