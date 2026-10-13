'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import App from '../App'
import { type Store, initial, load } from '../data'
import { supabase } from '../lib/supabase'

export default function WorkspaceGate(){
 const [user,setUser]=useState<User|null>(null)
 const [busy,setBusy]=useState(true)
 const [stored,setStored]=useState<Store|null>(null)
 const [email,setEmail]=useState('')
 const [message,setMessage]=useState('')
 const queue=useRef(Promise.resolve())
 useEffect(()=>{
  let alive=true
  supabase.auth.getUser().then(({data,error})=>{
   if(!alive)return
   if(error){setMessage(error.message);setBusy(false);return}
   setUser(data.user);if(!data.user)setBusy(false)
  }).catch(()=>{if(alive){setMessage('No se pudo conectar a Supabase.');setBusy(false)}})
  const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{if(alive)setUser(session?.user??null)})
  return ()=>{alive=false;listener.subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  if(!user){setStored(null);return}
  let alive=true
  setBusy(true)
  // Each account has an isolated JSON workspace protected by PostgreSQL RLS.
  supabase.from('workspaces').select('data').eq('user_id',user.id).maybeSingle().then(async({data,error})=>{
   if(!alive)return
   if(error){setMessage(error.message);setBusy(false);return}
   let value:Store
   if(data?.data && typeof data.data==='object' && Array.isArray((data.data as Store).clients)){
    value=data.data as Store
   }else{
    // The first sign-in imports any prior local version, otherwise seeds the clients.
    const local=load()
    value=local.clients.length?local:initial()
    const {error:writeError}=await supabase.from('workspaces').upsert({user_id:user.id,data:value,updated_at:new Date().toISOString()})
    if(writeError){if(alive){setMessage(writeError.message);setBusy(false)}return}
   }
   if(alive){setStored(value);setBusy(false);setMessage('')}
  }).catch(()=>{if(alive){setBusy(false);setMessage('No se pudieron cargar tus datos.')}})
  return ()=>{alive=false}
 },[user?.id])
 const onChange=useCallback((next:Store)=>{
  if(!user)return
  const userId=user.id
  // Serializing writes prevents a slow older update from replacing a newer one.
  queue.current=queue.current.then(async()=>{
   const {error}=await supabase.from('workspaces').upsert({user_id:userId,data:next,updated_at:new Date().toISOString()})
   if(error)throw error
  }).catch(e=>{setMessage('Error al sincronizar: '+String(e))})
 },[user?.id])
 async function signIn(event:React.FormEvent){
  event.preventDefault()
  setMessage('')
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}})
  setMessage(error?error.message:'Revisá tu correo para ingresar mediante el enlace de acceso.')
 }
 if(busy)return <div className="auth-shell"><p>Cargando tu espacio de trabajo…</p></div>
 if(!user)return <main className="auth-shell"><form className="auth-card" onSubmit={signIn}><h1>Informes FNG</h1><p>Iniciá sesión para sincronizar tus revisiones de Meta Ads entre dispositivos.</p><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/></label><button type="submit">Enviar enlace de acceso</button>{message&&<p role="status">{message}</p>}</form></main>
 if(!stored)return <main className="auth-shell"><p role="alert">{message||'No se pudo abrir el espacio de trabajo.'}</p><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></main>
 return <><div className="session-bar screen"><span>Conectado: {user.email}</span><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button>{message&&<span role="alert">{message}</span>}</div><App initialData={stored} onChange={onChange}/></>
}
