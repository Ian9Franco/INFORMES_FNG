'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { Client } from '../data'
import { sortClients } from '../clients'

export default function ClientPicker({ clients, value, onChange }: { clients: Client[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const id = useId()
  const calm = useReducedMotion()
  const selected = clients.find(client => client.id === value)
  const options = sortClients(clients).filter(client => `${client.name} ${client.advertisingAccounts?.map(account => `${account.accountId} ${account.owner}`).join(' ') ?? ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim()))

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function choose(clientId: string) {
    onChange(clientId)
    setOpen(false)
    trigger.current?.focus()
  }

  return <div className="client-picker" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <span className="field-label" id={`${id}-label`}>Cliente</span>
    <button ref={trigger} type="button" className="client-picker-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => { setQuery(''); setHighlight(0); setOpen(!open) }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setQuery(''); setHighlight(0); setOpen(true) } }}><span id={`${id}-value`}>{selected?.name ?? 'Elegí un cliente'}{selected?.advertisingAccounts?.[0] ? <small>Meta · {selected.advertisingAccounts[0].accountId}</small> : null}</span><ChevronDown size={18} className={open ? 'rotated' : ''} /></button>
    <AnimatePresence>{open ? <motion.div className="client-picker-menu" initial={calm ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: calm ? 0 : .16 }}>
      <div className="picker-search"><Search size={17} /><input ref={search} role="combobox" aria-label="Buscar cliente o cuenta publicitaria" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={options[highlight] ? `${id}-option-${options[highlight].id}` : undefined} placeholder="Nombre o ID de cuenta…" value={query} onChange={event => { setQuery(event.target.value); setHighlight(0) }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setHighlight(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Enter') { event.preventDefault(); if (options[highlight]) choose(options[highlight].id) }
      }} /></div>
      <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>{options.map((client, index) => <li key={client.id} id={`${id}-option-${client.id}`} role="option" aria-selected={client.id === value} className={index === highlight ? 'highlighted' : ''} ref={element => { if (index === highlight) element?.scrollIntoView({ block: 'nearest' }) }} onPointerMove={() => setHighlight(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(client.id)}><span><strong>{client.name}</strong>{client.advertisingAccounts?.[0] ? <small>{client.advertisingAccounts[0].owner} · {client.advertisingAccounts[0].accountId}</small> : null}</span>{client.id === value ? <Check size={16} /> : null}</li>)}</ul>
      {!options.length ? <p className="picker-empty">No encontré ese cliente.</p> : null}
    </motion.div> : null}</AnimatePresence>
  </div>
}
