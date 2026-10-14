'use client'

import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { isPasswordRecoveryRedirect, supabase } from '../lib/supabase'
import { authFeedback, parseAccessLink } from '../lib/auth-feedback'
import WorkspaceSkeleton from './WorkspaceSkeleton'
import ThemeToggle from './ThemeToggle'
import CloudWorkspace from './CloudWorkspace'
import AccountPasswordDialog from './AccountPasswordDialog'

type AccessMode = 'password' | 'email' | 'recovery'

export default function WorkspaceGate() {
  const client = supabase
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(Boolean(client))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [accessLink, setAccessLink] = useState('')
  const [mode, setMode] = useState<AccessMode>('password')
  const [passwordDialog, setPasswordDialog] = useState(isPasswordRecoveryRedirect)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const [cooldown, setCooldown] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (!client) return
    let alive = true
    client.auth.getUser().then(({ data, error }) => {
      if (!alive) return
      if (data.user) setUser(data.user)
      else if (!error || error.name === 'AuthSessionMissingError') setUser(null)
      if (error && error.name !== 'AuthSessionMissingError') setMessage(authFeedback(error))
      setBusy(false)
    }).catch(() => { if (alive) { setMessage('No se pudo conectar.'); setBusy(false) } })
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      setUser(session?.user ?? null)
      setBusy(false)
      if (event === 'PASSWORD_RECOVERY') setPasswordDialog(true)
      if (event === 'SIGNED_OUT') setPasswordDialog(false)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [client])

  function changeMode(next: AccessMode) { setMode(next); setMessage(''); setPassword(''); setAccessLink('') }

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!client || inFlight.current || (mode !== 'password' && cooldown > 0)) return
    inFlight.current = true
    setSubmitting(true)
    setMessage('')
    try {
      const address = email.trim()
      const redirectTo = `${window.location.origin}/`
      if (mode === 'password') {
        const { error } = await client.auth.signInWithPassword({ email: address, password })
        setPassword(''); setMessage(error ? authFeedback(error) : '')
      } else {
        const { error } = mode === 'recovery'
          ? await client.auth.resetPasswordForEmail(address, { redirectTo })
          : await client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectTo } })
        if (!error || error.status === 429) setCooldown(60)
        setMessage(error ? authFeedback(error, true) : mode === 'recovery'
          ? 'Si el correo corresponde a una cuenta, recibirás un enlace para elegir una contraseña. También depende del límite de envío de correos.'
          : 'Revisá tu correo para ingresar. Después podés definir una contraseña desde la barra superior y no pedir más enlaces para entrar.')
      }
    } catch { setPassword(''); setMessage('No se pudo conectar. Revisá tu conexión.') }
    finally { inFlight.current = false; setSubmitting(false) }
  }

  async function verifyLink(event: React.FormEvent) {
    event.preventDefault()
    if (!client || inFlight.current) return
    inFlight.current = true; setSubmitting(true); setMessage('')
    try {
      const credentials = parseAccessLink(accessLink, process.env.NEXT_PUBLIC_SUPABASE_URL!)
      const { error } = await client.auth.verifyOtp(credentials)
      if (error) setMessage(authFeedback(error))
      else if (credentials.type === 'recovery') setPasswordDialog(true)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'El enlace no es válido.') }
    finally { setAccessLink(''); inFlight.current = false; setSubmitting(false) }
  }

  if (!hydrated || busy) return <WorkspaceSkeleton />
  if (!client) return <App storageMode="local" />
  if (!user) return <main className="auth-shell">
    <div className="auth-theme"><ThemeToggle /></div>
    <div className="auth-card">
      <h1>Informes FNG</h1>
      <p>Ingresá con el mismo correo en todos tus dispositivos para compartir el avance. Los registros locales se conservarán al activar tu cuenta.</p>
      <p className="auth-explanation">{mode === 'password' ? 'El acceso con contraseña no envía correos. Si sólo usaste un enlace, todavía no se creó una contraseña para vos.' : mode === 'recovery' ? 'Recuperar el acceso requiere verificar tu correo. No permite evitar el límite de envío de Supabase.' : 'El primer acceso verifica tu correo. Después elegí tu contraseña desde «Contraseña de mi cuenta».'}</p>
      <form onSubmit={signIn} aria-busy={submitting}>
        <label htmlFor="access-email">Correo electrónico</label>
        <input id="access-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@email.com" disabled={submitting} />
        {mode === 'password' ? <><label htmlFor="access-password">Contraseña</label><input id="access-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={submitting} /></> : null}
        <button type="submit" disabled={submitting || (mode !== 'password' && cooldown > 0)}>{submitting ? 'Procesando…' : mode !== 'password' && cooldown > 0 ? `Esperá ${cooldown} s para reenviar` : mode === 'password' ? 'Ingresar' : mode === 'recovery' ? 'Enviar enlace de recuperación' : 'Enviar enlace de acceso'}</button>
      </form>
      <button type="button" className="auth-alternative" disabled={submitting} onClick={() => changeMode(mode === 'password' ? 'email' : 'password')}>{mode === 'password' ? 'No tengo contraseña · ingresar por correo' : 'Ya tengo contraseña'}</button>
      {mode === 'password' ? <button type="button" className="auth-alternative" disabled={submitting} onClick={() => changeMode('recovery')}>Olvidé mi contraseña</button> : null}
      {mode !== 'password' ? <details className="auth-link-fallback">
        <summary>Ya recibí un enlace, pero no abre la web</summary>
        <p>Si todavía no lo usaste, copiá la dirección del enlace original de Supabase y pegala aquí. No pide otro correo ni se guarda; los enlaces usados o vencidos no se pueden reutilizar.</p>
        <form onSubmit={verifyLink}><label htmlFor="access-link">Enlace de acceso recibido</label><input id="access-link" type="text" autoComplete="off" value={accessLink} onChange={event => setAccessLink(event.target.value)} required disabled={submitting} /><button disabled={submitting}>Verificar enlace</button></form>
      </details> : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  </main>
  return <>
    <div className="session-bar screen"><span>{user.email}</span><button onClick={() => setPasswordDialog(true)}>Contraseña de mi cuenta</button><button onClick={() => client.auth.signOut()}>Cerrar sesión</button></div>
    <CloudWorkspace key={user.id} user={user} />
    {passwordDialog ? <AccountPasswordDialog key={user.id} onClose={() => setPasswordDialog(false)} /> : null}
  </>
}
