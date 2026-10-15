'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { STORY_DAYS, type StoryDay } from '../review-actions'

export default function StoryDayPicker({ value, onChange }: { value: StoryDay[]; onChange: (days: StoryDay[]) => void }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  function position() {
    if (!trigger.current || !menu.current) return
    const bounds = trigger.current.getBoundingClientRect()
    const viewport = window.visualViewport
    const width = Math.min(300, (viewport?.width ?? innerWidth) - 24)
    const height = viewport?.height ?? innerHeight
    const top = viewport?.offsetTop ?? 0
    const x = Math.max(12, Math.min(bounds.left, innerWidth - width - 12))
    const menuHeight = menu.current.offsetHeight || 284
    const y = Math.max(top + 12, Math.min(bounds.bottom + 8, top + height - menuHeight - 12))
    Object.assign(menu.current.style, { width: `${width}px`, left: `${x}px`, top: `${y}px`, maxHeight: `${height - 24}px` })
  }
  useEffect(() => {
    if (!open) return
    const close = () => menu.current?.hidePopover()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.addEventListener('pagehide', close)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); window.visualViewport?.removeEventListener('resize', position); window.removeEventListener('pagehide', close) }
  }, [open])
  function close() { menu.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }) }
  const label = STORY_DAYS.filter(day => value.includes(day.id)).map(day => day.short).join(' · ')
  return <div className="story-day-control">
    <button ref={trigger} type="button" className="story-day-trigger" popoverTarget={id} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={position}><CalendarDays size={15} aria-hidden="true" /><span>Para {label}</span><ChevronDown size={14} aria-hidden="true" /></button>
    <div ref={menu} id={id} popover="auto" className="story-day-menu screen" role="dialog" aria-label="Días de la historia programada" onToggle={event => { const visible = event.currentTarget.matches(':popover-open'); setOpen(visible); if (visible) { position(); event.currentTarget.querySelector<HTMLButtonElement>('[role="checkbox"]:not(:disabled)')?.focus({ preventScroll: true }) } }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close() } }}>
      <strong>¿Para qué días?</strong><p>Podés elegir varios. Conservá al menos uno.</p>
      <div role="group" aria-label="Días programados">{STORY_DAYS.map(day => <button key={day.id} type="button" role="checkbox" aria-label={day.label} aria-checked={value.includes(day.id)} disabled={value.length === 1 && value.includes(day.id)} onClick={() => onChange(STORY_DAYS.filter(option => option.id === day.id ? !value.includes(day.id) : value.includes(option.id)).map(option => option.id))}>{day.short}<span aria-hidden="true">{value.includes(day.id) ? '✓' : '+'}</span></button>)}</div>
      <button type="button" className="story-days-done" onClick={close}>Listo</button>
    </div>
  </div>
}
