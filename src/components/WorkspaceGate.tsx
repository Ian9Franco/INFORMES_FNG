'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { type Store, initial, load } from '../data'
import { supabase } from '../lib/supabase'
import WorkspaceSkeleton from './WorkspaceSkeleton'

export default function WorkspaceGate() {
  const client = supabase
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(Boolean(client))
  const [stored, setStored] = useState<Store | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const queue = useRef(Promise.resolve())
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  useEffect(() => {
    if (!client) return
    let alive = true
    client.auth.getUser().then(({ data, error }) => {
      if (!alive) return
      if (error) {
        setMessage(error.message)
        setBusy(false)
        return
      }
      setUser(data.user)
      if (!data.user) setBusy(false)
    }).catch(() => {
      if (alive) {
        setMessage('No se pudo conectar a Supabase.')
        setBusy(false)
      }
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [client])

  useEffect(() => {
    if (!client || !user) {
      setStored(null)
      return
    }
    let alive = true
    setBusy(true)
    const fetchWorkspace = async () => {
      const { data, error } = await client.from('workspaces').select('data').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (error) {
        setMessage(error.message)
        setBusy(false)
        return
      }
      let value: Store
      if (data?.data && typeof data.data === 'object' && Array.isArray((data.data as Store).clients)) {
        value = data.data as Store
      } else {
        const local = load()
        value = local.clients.length ? local : initial()
        const { error: writeError } = await client.from('workspaces').upsert({ user_id: user.id, data: value, updated_at: new Date().toISOString() })
        if (writeError) {
          if (alive) {
            setMessage(writeError.message)
            setBusy(false)
          }
          return
        }
      }
      if (alive) {
        setStored(value)
        setBusy(false)
        setMessage('')
      }
    }
    void fetchWorkspace().catch(() => {
      if (alive) {
        setBusy(false)
        setMessage('No se pudieron cargar tus datos.')
      }
    })
    return () => { alive = false }
  }, [client, user])

  const onChange = useCallback((next: Store) => {
    if (!client || !user) return
    const userId = user.id
    queue.current = queue.current.then(async () => {
      const { error } = await client.from('workspaces').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
      if (error) throw error
    }).catch(error => setMessage(`Error al sincronizar: ${String(error)}`))
  }, [client, user])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!client) return
    setMessage('')
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setMessage(error ? error.message : 'Revisá tu correo para ingresar mediante el enlace de acceso.')
  }

  if (!hydrated || busy) return <WorkspaceSkeleton />
  if (!client) return <App storageMode="local" />
  if (!user) return <main className="auth-shell"><form className="auth-card" onSubmit={signIn}><h1>Informes FNG</h1><p>Iniciá sesión para sincronizar tus revisiones y trabajar desde más de un dispositivo.</p><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@email.com" /></label><button type="submit">Enviar enlace de acceso</button>{message ? <p role="status">{message}</p> : null}</form></main>
  if (!stored) return <main className="auth-shell"><div className="auth-card"><h1>No pudimos abrir tu espacio</h1><p role="alert">{message || 'Intentá cerrar la sesión e ingresar nuevamente.'}</p><button onClick={() => client.auth.signOut()}>Cerrar sesión</button></div></main>
  return <><div className="session-bar screen"><span>Conectado como {user.email}</span><button onClick={() => client.auth.signOut()}>Cerrar sesión</button>{message ? <span role="alert">{message}</span> : null}</div><App initialData={stored} onChange={onChange} storageMode="cloud" /></>
}
