'use client'

// Adapted from SmoothUI Animated Tags, Copyright (c) 2024 Eduardo Calvo (MIT).
// https://github.com/educlopez/smoothui — license in THIRD_PARTY_NOTICES.md.
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { Minus, Plus, Star, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { ACTION_TYPES, actionDefinition, availableCustomActions, entryDefinition, definitionService, isScheduledAction, todayStoryDay, type CustomAction, type ActionTypeId, type ReviewAction } from '../review-actions'
import { WORK_SERVICES, serviceLabel, type WorkService } from '../work-services'
import StoryDayPicker from './StoryDayPicker'
import CreateAction from './CreateAction'
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

const defaultFavorites: ActionTypeId[] = ['meta.ad.created', 'meta.ad.deleted', 'meta.ad.updated', 'meta.budget.updated', 'google.keyword.updated', 'google.asset_group.updated', 'google.youtube.video_uploaded', 'google.budget.updated']

function readPreferences(key: string): { platform: WorkService; favorites: ActionTypeId[] } {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    if (value && Array.isArray(value.favorites)) return { platform: WORK_SERVICES.includes(value.platform) ? value.platform : 'meta_ads', favorites: value.favorites.filter((id: unknown): id is ActionTypeId => typeof id === 'string' && (Boolean(actionDefinition(id)) || /^custom\./.test(id))) }
  } catch { /* Preferences do not block registration. */ }
  return { platform: 'meta_ads', favorites: defaultFavorites }
}

export default function QuickActions({ value, onChange, compact = false, storageKey = 'fng-action-prefs:local', clientId, catalog = [], onCreate, lockedPlatform }: { lockedPlatform?: WorkService; clientId?: string; catalog?: CustomAction[]; onCreate?: (action: CustomAction) => void; value: ReviewAction[]; onChange: (value: ReviewAction[]) => void; compact?: boolean; storageKey?: string }) {
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey))
  const [showAll, setShowAll] = useState(!compact)
  const { platform: preferredPlatform, favorites } = preferences
  const platform = lockedPlatform ?? preferredPlatform
  const definitions = [...ACTION_TYPES, ...availableCustomActions(catalog, clientId)]
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Kept for this session. */ } }, [preferences, storageKey])
  const group = useId()
  const calm = useReducedMotion()
  const transition = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 32 }
  function add(typeId: ActionTypeId, customDefinition = catalog.find(item => item.id === typeId)) {
    if (value.length >= 40 || value.some(item => item.typeId === typeId)) return
    onChange([...value, { id: crypto.randomUUID(), typeId, quantity: 1, source: 'manual', evidence: 'user_confirmed', ...(customDefinition ? { customDefinition } : {}), ...(isScheduledAction(typeId) ? { scheduledDays: [todayStoryDay()] } : {}) }])
  }
  function quantity(id: string, count: number) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 999) return
    onChange(value.map(item => item.id === id ? { ...item, quantity: count } : item))
  }
  return <LayoutGroup id={group}><section className={`quick-actions ${compact ? 'is-compact' : ''}`} aria-label="Acciones rápidas">
    <div className="quick-actions-heading"><div><h3>¿Qué hiciste hoy?</h3><p>Elegí acciones y ajustá la cantidad.</p></div><span>{value.length} seleccionadas</span></div>
    {lockedPlatform ? <p className="review-platform-context">{serviceLabel(lockedPlatform)} · revisión independiente</p> : <div className="platform-switch" role="group" aria-label="Servicio de trabajo">{WORK_SERVICES.map(item => <button type="button" key={item} aria-pressed={platform === item} onClick={() => setPreferences(current => ({ ...current, platform: item }))}>{platform === item ? <motion.span className="platform-highlight" layoutId="platform" transition={transition} /> : null}<span>{serviceLabel(item)}</span></button>)}</div>}
    <div className="available-action-tags" aria-label="Añadir una acción">{definitions.filter(item => definitionService(item) === platform && (showAll || favorites.includes(item.id) || isScheduledAction(item.id) || item.id.startsWith('custom.'))).map(item => {
      const selected = value.find(entry => entry.typeId === item.id)
      return <div className="action-tile" key={item.id}><button type="button" data-action-type-id={item.id} aria-pressed={Boolean(selected)} disabled={!selected && value.length >= 40} title={'scope' in item ? item.scope === 'client' ? 'Sólo este cliente' : 'Todos mis clientes' : undefined} onClick={() => selected ? onChange(value.filter(entry => entry.id !== selected.id)) : add(item.id)}>{selected ? <AnimatedCheck /> : <Plus size={14} aria-hidden="true" />}{item.label}</button>{showAll ? <button type="button" className="favorite-action" aria-label={`${favorites.includes(item.id) ? 'Quitar de favoritas' : 'Añadir a favoritas'}: ${item.label}`} aria-pressed={favorites.includes(item.id)} onClick={() => setPreferences(current => ({ ...current, favorites: current.favorites.includes(item.id) ? current.favorites.filter(id => id !== item.id) : [...current.favorites, item.id] }))}><Star size={14} fill={favorites.includes(item.id) ? 'currentColor' : 'none'} aria-hidden="true" /></button> : null}</div>
    })}</div>
    {compact ? <button className="text-button action-catalog-toggle" type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Sólo favoritas' : 'Más acciones · personalizar favoritas'}</button> : null}
    {onCreate ? <CreateAction key={`${clientId ?? 'general'}:${platform}`} clientId={clientId} platform={platform} catalog={catalog} onCreate={definition => { onCreate(definition); add(definition.id, definition) }} /> : null}
    <div className="selected-action-tags" aria-label="Acciones seleccionadas"><AnimatePresence initial={false} mode="popLayout">{value.map(item => {
      const definition = entryDefinition(item)!
      return <motion.div className={`selected-action ${isScheduledAction(item.typeId) ? 'has-schedule' : ''}`} key={item.id} layout="position" data-action-id={item.id} data-action-type-id={item.typeId} initial={calm ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transition}>
        <span className="action-selected-check"><AnimatedCheck /></span><div className="selected-action-label"><small>{serviceLabel(definitionService(definition))}</small><strong>{definition.label}</strong></div>
        <div className="action-quantity"><button type="button" disabled={item.quantity <= 1} onClick={() => quantity(item.id, item.quantity - 1)} aria-label={`Reducir cantidad: ${definition.label}`}><Minus size={14} /></button><QuantityInput value={item.quantity} label={definition.label} onCommit={next => quantity(item.id, next)} /><button type="button" disabled={item.quantity >= 999} onClick={() => quantity(item.id, item.quantity + 1)} aria-label={`Aumentar cantidad: ${definition.label}`}><Plus size={14} /></button></div>
        <button type="button" className="remove-action" onClick={() => onChange(value.filter(selected => selected.id !== item.id))} aria-label={`Quitar acción: ${definition.label}`}><X size={16} /></button>
        {isScheduledAction(item.typeId) ? <StoryDayPicker publication={item.typeId === 'meta.post.scheduled'} value={item.scheduledDays!} onChange={scheduledDays => onChange(value.map(entry => entry.id === item.id ? { ...entry, scheduledDays } : entry))} /> : null}
      </motion.div>
    })}</AnimatePresence>{!value.length ? <p className="quick-actions-empty">Las acciones elegidas aparecen acá. También podés registrar una revisión sin cambios.</p> : null}</div>
  </section></LayoutGroup>
}
