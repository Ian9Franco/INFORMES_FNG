'use client'

// Adapted from SmoothUI Animated Tags, Copyright (c) 2024 Eduardo Calvo (MIT).
// https://github.com/educlopez/smoothui — license in THIRD_PARTY_NOTICES.md.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Minus, Plus, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { ACTION_TYPES, actionDefinition, type AdPlatform, type ActionTypeId, type ReviewAction } from '../review-actions'
import { AnimatedCheck } from './AnimatedSymbols'

function QuantityInput({ value, label, onCommit }: { value: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <input type="number" inputMode="numeric" min="1" max="999" value={draft} aria-label={`Cantidad: ${label}`} onFocus={event => event.currentTarget.select()} onChange={event => {
    setDraft(event.target.value)
    const next = event.target.valueAsNumber
    if (Number.isSafeInteger(next) && next >= 1 && next <= 999) onCommit(next)
  }} onBlur={() => setDraft(String(value))} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}

export default function QuickActions({ value, onChange }: { value: ReviewAction[]; onChange: (value: ReviewAction[]) => void }) {
  const [platform, setPlatform] = useState<AdPlatform>('meta_ads')
  const group = useId()
  const calm = useReducedMotion()
  const transition = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 32 }
  function add(typeId: ActionTypeId) {
    if (value.some(item => item.typeId === typeId)) return
    onChange([...value, { id: crypto.randomUUID(), typeId, quantity: 1, source: 'manual', evidence: 'user_confirmed' }])
  }
  function quantity(id: string, count: number) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 999) return
    onChange(value.map(item => item.id === id ? { ...item, quantity: count } : item))
  }
  return <LayoutGroup id={group}><section className="quick-actions" aria-label="Acciones rápidas">
    <div className="quick-actions-heading"><div><h3>¿Qué hiciste hoy?</h3><p>Elegí acciones y ajustá la cantidad.</p></div><span>{value.length} seleccionadas</span></div>
    <div className="platform-switch" role="group" aria-label="Plataforma publicitaria">{(['meta_ads', 'google_ads'] as const).map(item => <button type="button" key={item} aria-pressed={platform === item} onClick={() => setPlatform(item)}>{platform === item ? <motion.span className="platform-highlight" layoutId="platform" transition={transition} /> : null}<span>{item === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}</span></button>)}</div>
    <div className="available-action-tags" aria-label="Añadir una acción"><AnimatePresence initial={false} mode="popLayout">{ACTION_TYPES.filter(item => item.platform === platform && !value.some(selected => selected.typeId === item.id)).map(item => <motion.button type="button" key={item.id} layout data-action-type-id={item.id} initial={calm ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: calm ? 1 : .95 }} transition={transition} onClick={() => add(item.id)}><Plus size={14} aria-hidden="true" />{item.label}</motion.button>)}</AnimatePresence></div>
    <div className="selected-action-tags" aria-label="Acciones seleccionadas"><AnimatePresence initial={false} mode="popLayout">{value.map(item => {
      const definition = actionDefinition(item.typeId)!
      return <motion.div className="selected-action" key={item.id} layout data-action-id={item.id} data-action-type-id={item.typeId} initial={calm ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: calm ? 0 : -6 }} transition={transition}>
        <span className="action-selected-check"><AnimatedCheck /></span><div className="selected-action-label"><small>{definition.platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}</small><strong>{definition.label}</strong></div>
        <div className="action-quantity"><button type="button" disabled={item.quantity <= 1} onClick={() => quantity(item.id, item.quantity - 1)} aria-label={`Reducir cantidad: ${definition.label}`}><Minus size={14} /></button><QuantityInput value={item.quantity} label={definition.label} onCommit={next => quantity(item.id, next)} /><button type="button" disabled={item.quantity >= 999} onClick={() => quantity(item.id, item.quantity + 1)} aria-label={`Aumentar cantidad: ${definition.label}`}><Plus size={14} /></button></div>
        <button type="button" className="remove-action" onClick={() => onChange(value.filter(selected => selected.id !== item.id))} aria-label={`Quitar acción: ${definition.label}`}><X size={16} /></button>
      </motion.div>
    })}</AnimatePresence>{!value.length ? <p className="quick-actions-empty">Las acciones elegidas aparecen acá. También podés registrar una revisión sin cambios.</p> : null}</div>
  </section></LayoutGroup>
}
