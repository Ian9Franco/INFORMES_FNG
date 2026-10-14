'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { supabase } from '../lib/supabase'
import WorkspaceSkeleton from './WorkspaceSkeleton'
import ThemeToggle from './ThemeToggle'
import CloudWorkspace from './CloudWorkspace'

export default function WorkspaceGate() {
  const client = supabase
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(Boolean(client))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [accessLink, setAccessLink] = useState('')
  const [passwordMode, setPasswordMode] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  useEffect(() => {
    if (!client) return
    let alive = true
    client.auth.getUser().then(({ data, error }) => {
      if (!alive) return
      if (data.user) setUser(data.user)
      else if (!error || error.name === 'AuthSessionMissingError') setUser(null)
      if (error && error.name !== 'AuthSessionMissingError') setMessage(error.message)
      setBusy(false)
    }).catch(() => { if (alive) { setMessage('No se pudo conectar.'); setBusy(false) } })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) { setUser(session?.user ?? null); setBusy(false) }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [client])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!client) return
    setMessage('')
    if (passwordMode) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      setPassword(''); setMessage(error ? error.message : '')
    } else {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
      setMessage(error ? error.message : 'Revisá tu correo para ingresar. Usá el mismo correo en la PC y en el celular.')
    }
  }

  if (!hydrated || busy) return <WorkspaceSkeleton />
  if (!client) return <App storageMode="local" />
  if (!user) return <main className="auth-shell"><div className="auth-theme"><ThemeToggle /></div><div className="auth-card"><h1>Informes FNG</h1><p>Ingresá con el mismo correo en todos tus dispositivos para compartir el avance. Los registros locales se conservarán al activar tu cuenta.</p><form onSubmit={signIn}><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@email.com" /></label>{passwordMode ? <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label> : null}<button type="submit">{passwordMode ? 'Ingresar' : 'Enviar enlace de acceso'}</button></form><button type="button" className="auth-alternative" onClick={() => { setPasswordMode(!passwordMode); setPassword('') }}>{passwordMode ? 'Ingresar por enlace de correo' : 'Ya tengo contraseña'}</button>{!passwordMode ? <details className="auth-link-fallback"><summary>El enlace del correo no abre la web</summary><p>Copiá la dirección del enlace de acceso y pegala aquí. Se verifica una sola vez y no se guarda.</p><form onSubmit={async event => { event.preventDefault(); try { const link = new URL(accessLink); const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!); if (link.origin !== expected.origin || !link.searchParams.get('token')) throw new Error('Pegá el enlace de acceso original de Supabase.'); const type = link.searchParams.get('type'); if (type !== 'magiclink' && type !== 'signup' && type !== 'email') throw new Error('El enlace no es de ingreso.'); const { error } = await client.auth.verifyOtp({ token_hash: link.searchParams.get('token')!, type }); setAccessLink(''); setMessage(error ? error.message : '') } catch (error) { setMessage(error instanceof Error ? error.message : 'El enlace no es válido.') } }}><label>Enlace de acceso recibido<input type="text" autoComplete="off" value={accessLink} onChange={event => setAccessLink(event.target.value)} required /></label><button>Verificar enlace</button></form></details> : null}{message ? <p role="status">{message}</p> : null}</div></main>
  return <><div className="session-bar screen"><span>{user.email}</span><button onClick={() => client.auth.signOut()}>Cerrar sesión</button></div><CloudWorkspace key={user.id} user={user} /></>
}
