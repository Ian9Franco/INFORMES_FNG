'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { STORY_DAYS, formatDayQuantities, type StoryDay, type StoryDayCount } from '../review-actions'

type DayProps = { publication?: boolean; value: StoryDay[]; onChange: (days: StoryDay[]) => void; counts?: undefined; onCounts?: undefined }
type CountProps = { counts: StoryDayCount[]; onCounts: (counts: StoryDayCount[]) => void; publication?: false; value?: undefined; onChange?: undefined }

export default function StoryDayPicker(props: DayProps | CountProps) {
  const counting = props.counts !== undefined
  const value = counting ? props.counts.map(item => item.day) : props.value
  function changeDays(days: StoryDay[]) { if (!counting) props.onChange(days) }
  function changeCounts(counts: StoryDayCount[]) { if (counting) props.onCounts(counts) }
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  function position() {
    if (!trigger.current || !menu.current) return
    const bounds = trigger.current.getBoundingClientRect()
    const viewport = window.visualViewport
    const width = Math.min(counting ? 360 : 300, (viewport?.width ?? innerWidth) - 24)
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
  const publication = props.publication === true
  const label = counting ? formatDayQuantities(props.counts) : `Para ${STORY_DAYS.filter(day => value.includes(day.id)).map(day => day.short).join(' · ')}`
  function toggle(day: StoryDay) {
    if (counting) {
      const selected = props.counts.some(item => item.day === day)
      if (selected && props.counts.length === 1) return
      changeCounts(selected ? props.counts.filter(item => item.day !== day) : STORY_DAYS.flatMap(option => option.id === day ? [{ day, quantity: 1 }] : props.counts.filter(item => item.day === option.id)))
      return
    }
    changeDays(STORY_DAYS.filter(option => option.id === day ? !value.includes(day) : value.includes(option.id)).map(option => option.id))
  }
  function setQuantity(day: StoryDay, quantity: number) {
    if (!counting || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return
    changeCounts(props.counts.map(item => item.day === day ? { day, quantity } : item))
  }
  return <div className="story-day-control">
    <button ref={trigger} type="button" className="story-day-trigger" popoverTarget={id} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={position}><CalendarDays size={15} aria-hidden="true" /><span>{label}</span><ChevronDown size={14} aria-hidden="true" /></button>
    <div ref={menu} id={id} popover="auto" className={`story-day-menu screen${counting ? ' is-counts' : ''}`} role="dialog" aria-label={counting ? 'Cuántas historias para cada día' : publication ? 'Días de la publicación programada' : 'Días de la historia programada'} onToggle={event => { const visible = event.currentTarget.matches(':popover-open'); setOpen(visible); if (visible) { position(); event.currentTarget.querySelector<HTMLButtonElement>('[role="checkbox"]:not(:disabled)')?.focus({ preventScroll: true }) } }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close() } }}>
      <strong>{counting ? '¿Cuántas para cada día?' : '¿Para qué días?'}</strong><p>{counting ? 'El número es sólo de ese día. El total de arriba es la suma. Conservá al menos un día.' : 'Podés elegir varios. Conservá al menos uno.'}</p>
      <div role="group" aria-label="Días programados">{STORY_DAYS.map(day => {
        const selected = value.includes(day.id)
        const count = counting ? props.counts.find(item => item.day === day.id)?.quantity : undefined
        return <div className="story-day-row" key={day.id}><button type="button" role="checkbox" aria-label={day.label} aria-checked={selected} disabled={value.length === 1 && selected} onClick={() => toggle(day.id)}>{day.short}<span aria-hidden="true">{selected ? '✓' : '+'}</span></button>{counting && selected ? <span className="story-day-quantity"><button type="button" aria-label={`Menos historias para ${day.label}`} disabled={(count ?? 1) <= 1} onClick={() => setQuantity(day.id, (count ?? 1) - 1)}>−</button><input type="number" inputMode="numeric" min={1} max={999} aria-label={`Cantidad para ${day.label}`} value={count ?? 1} onChange={event => { const next = event.target.valueAsNumber; if (Number.isSafeInteger(next)) setQuantity(day.id, next) }} /><button type="button" aria-label={`Más historias para ${day.label}`} disabled={(count ?? 1) >= 999} onClick={() => setQuantity(day.id, (count ?? 1) + 1)}>+</button></span> : null}</div>
      })}</div>
      <button type="button" className="story-days-done" onClick={close}>Listo</button>
    </div>
  </div>
}
