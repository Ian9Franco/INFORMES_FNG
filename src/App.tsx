'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react'
import QuickActions from './components/QuickActions'
import { AnimatedChart } from './components/AnimatedSymbols'
import { ACTION_SCHEMA_VERSION, describeReviewActions, validReviewActions, type ReviewAction } from './review-actions'
import {
  type Client,
  type Review,
  type Store,
  date,
  format,
  keyDate,
  load,
  monday,
  persist,
  weekDays,
} from './data'

type Tab = 'jornada' | 'semana' | 'clientes' | 'informes'
type PrintMode = 'grilla' | 'detalle'
type ClientFilter = 'activos' | 'archivados' | 'todos'
type IconName = 'home' | 'calendar' | 'users' | 'report' | 'plus' | 'search' | 'check' | 'clock' | 'archive' | 'trash' | 'download' | 'upload' | 'print' | 'chevron-left' | 'chevron-right' | 'close' | 'lock' | 'unlock'

const weekdays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const uid = () => crypto.randomUUID()

const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  archive: <><path d="M3 6h18M5 6v14h14V6M9 10h6"/><path d="M4 3h16v3H4z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 20h14"/></>,
  upload: <><path d="M12 16V4m0 0 5 5m-5-5L7 9"/><path d="M5 20h14"/></>,
  print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></>,
  'chevron-left': <path d="m15 18-6-6 6-6"/>,
  'chevron-right': <path d="m9 18 6-6-6-6"/>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  unlock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

const navItems: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'jornada', label: 'Mi jornada', icon: 'home' },
  { id: 'semana', label: 'Semana', icon: 'calendar' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'informes', label: 'Informes', icon: 'report' },
]

function WeekPicker({ label, onPrevious, onNext }: { label: string; onPrevious: () => void; onNext: () => void }) {
  return <div className="week-picker" aria-label="Cambiar semana">
    <button className="icon-button" onClick={onPrevious} aria-label="Semana anterior"><Icon name="chevron-left" /></button>
    <span>{label}</span>
    <button className="icon-button" onClick={onNext} aria-label="Semana siguiente"><Icon name="chevron-right" /></button>
  </div>
}

function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="empty-state"><span><Icon name={icon} size={22} /></span><h3>{title}</h3><p>{text}</p></div>
}

export default function App({ initialData, onChange, storageMode = 'local' }: { initialData?: Store; onChange?: (data: Store) => void; storageMode?: 'local' | 'cloud' }) {
  const [db, setDb] = useState<Store>(() => initialData ?? load())
  const [tab, setTab] = useState<Tab>('jornada')
  const [week, setWeek] = useState(() => monday(new Date()))
  const [selected, setSelected] = useState<{ id: string; day: string } | null>(null)
  const [actions, setActions] = useState('')
  const [actionEntries, setActionEntries] = useState<ReviewAction[]>([])
  const calm = useReducedMotion()
  const [observations, setObservations] = useState('')
  const [pendingText, setPendingText] = useState('')
  const [newName, setNewName] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('activos')
  const [printMode, setPrintMode] = useState<PrintMode>('grilla')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dailySearch, setDailySearch] = useState('')
  const [closingReview, setClosingReview] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollPositions = useRef<Partial<Record<Tab, number>>>({})
  const selectedOpen = selected !== null

  const today = keyDate(new Date())
  const days = weekDays(week)
  const active = db.clients.filter(clientItem => clientItem.active)
  const closed = db.closed.includes(week)
  const inWeek = db.reviews.filter(reviewItem => days.includes(reviewItem.date))
  const pending = db.pending.filter(item => !item.resolved)
  const reviewsToday = active.filter(clientItem => db.reviews.some(reviewItem => reviewItem.clientId === clientItem.id && reviewItem.date === today)).length
  const completion = active.length ? Math.round((reviewsToday / active.length) * 100) : 0
  const current = selected ? db.reviews.find(reviewItem => reviewItem.clientId === selected.id && reviewItem.date === selected.day) : undefined
  const client = selected ? db.clients.find(clientItem => clientItem.id === selected.id) : undefined
  const weekLabel = `${format(days[0])} al ${format(days[5])} de ${date(days[5]).getFullYear()}`
  const longToday = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const dailyClients = active.filter(item => item.name.toLocaleLowerCase('es').includes(dailySearch.trim().toLocaleLowerCase('es')))

  function navigate(next: Tab) {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    const update = () => {
      flushSync(() => setTab(next))
      window.scrollTo({ top: scrollPositions.current[next] ?? 0, behavior: 'instant' })
    }
    update()
  }

  function closeReview(force = false) {
    if (closingReview) return
    const dirty = actions !== (current?.actions ?? '') || observations !== (current?.observations ?? '') || pendingText.trim() !== '' || JSON.stringify(actionEntries) !== JSON.stringify(current?.actionEntries ?? [])
    if (!force && dirty && !window.confirm('Tenés cambios sin guardar. ¿Cerrar la revisión y descartarlos?')) return
    setClosingReview(true)
    closeTimer.current = setTimeout(() => {
      setSelected(null)
      setClosingReview(false)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
  }

  useEffect(() => {
    if (!selectedOpen) return
    const dialog = dialogRef.current
    const scrollY = window.scrollY
    const previousStyle = document.body.style.cssText
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    dialog?.showModal()
    const viewport = window.visualViewport
    const syncViewport = () => {
      if (!dialog || !viewport || viewport.scale !== 1) return
      dialog.style.setProperty('--visible-height', `${viewport.height}px`)
      dialog.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
    }
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    return () => {
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      dialog?.close()
      document.body.style.cssText = previousStyle
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    }
  }, [selectedOpen])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('es')
    return db.clients.filter(clientItem => {
      const matchesState = clientFilter === 'todos' || (clientFilter === 'activos' ? clientItem.active : !clientItem.active)
      return matchesState && (!query || clientItem.name.toLocaleLowerCase('es').includes(query))
    })
  }, [clientFilter, clientSearch, db.clients])

  useEffect(() => {
    try {
      persist(db)
      onChange?.(db)
      setError('')
    } catch {
      setError('No se pudieron guardar los datos. Exportá una copia de seguridad.')
    }
  }, [db, onChange])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function findReview(clientId: string, day: string) {
    return db.reviews.find(reviewItem => reviewItem.clientId === clientId && reviewItem.date === day)
  }

  function openReview(clientId: string, day: string) {
    if (db.closed.includes(monday(date(day)))) {
      setNotice('Semana cerrada. Reabrila desde Semana para editar.')
      return
    }
    const reviewItem = findReview(clientId, day)
    setSelected({ id: clientId, day })
    setActions(reviewItem?.actions ?? '')
    setActionEntries(validReviewActions(reviewItem?.actionEntries) ? reviewItem.actionEntries : [])
    setObservations(reviewItem?.observations ?? '')
    setPendingText('')
  }

  function saveReview() {
    if (!selected?.id || closingReview || db.closed.includes(monday(date(selected.day))) || !validReviewActions(actionEntries)) return
    const previous = findReview(selected.id, selected.day)
    const item: Review = {
      id: previous?.id ?? uid(),
      clientId: selected.id,
      date: selected.day,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      actions: actions.trim(),
      actionSchemaVersion: ACTION_SCHEMA_VERSION,
      actionEntries,
      observations: observations.trim(),
    }
    setDb(currentDb => ({
      ...currentDb,
      reviews: [...currentDb.reviews.filter(reviewItem => reviewItem.clientId !== selected.id || reviewItem.date !== selected.day), item],
    }))
    closeReview(true)
    setNotice(previous ? 'Revisión actualizada' : 'Revisión registrada')
  }

  function removeReview() {
    if (!current) return
    if (!window.confirm('¿Quitar esta revisión? Las observaciones asociadas también se eliminarán.')) return
    setDb(currentDb => ({ ...currentDb, reviews: currentDb.reviews.filter(reviewItem => reviewItem.id !== current.id) }))
    closeReview(true)
    setNotice('Revisión eliminada')
  }

  function addPending() {
    if (!selected?.id || !pendingText.trim()) return
    setDb(currentDb => ({
      ...currentDb,
      pending: [...currentDb.pending, { id: uid(), clientId: selected.id, text: pendingText.trim(), resolved: false }],
    }))
    setPendingText('')
    setNotice('Pendiente agregado')
  }

  function resolvePending(pendingId: string) {
    setDb(currentDb => ({
      ...currentDb,
      pending: currentDb.pending.map(item => item.id === pendingId ? { ...item, resolved: true } : item),
    }))
    setNotice('Pendiente completado')
  }

  function addClient(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim().toLocaleUpperCase('es')
    if (!name) return
    if (db.clients.some(clientItem => clientItem.name === name)) {
      setError('Ya existe un cliente con ese nombre.')
      return
    }
    setDb(currentDb => ({ ...currentDb, clients: [...currentDb.clients, { id: uid(), name, active: true }] }))
    setNewName('')
    setNotice('Cliente agregado')
  }

  function toggleClient(clientItem: Client) {
    setDb(currentDb => ({
      ...currentDb,
      clients: currentDb.clients.map(item => item.id === clientItem.id ? { ...item, active: !item.active } : item),
    }))
    setNotice(clientItem.active ? 'Cliente archivado' : 'Cliente reactivado')
  }

  function deleteClient(clientItem: Client) {
    const hasHistory = db.reviews.some(item => item.clientId === clientItem.id) || db.pending.some(item => item.clientId === clientItem.id)
    if (hasHistory) {
      setError('Este cliente tiene historial. Podés archivarlo para conservar sus revisiones y pendientes.')
      return
    }
    if (!window.confirm(`¿Eliminar definitivamente a ${clientItem.name}?`)) return
    setDb(currentDb => ({ ...currentDb, clients: currentDb.clients.filter(item => item.id !== clientItem.id) }))
    setNotice('Cliente eliminado')
  }

  function changeWeek(amount: number) {
    const next = date(week)
    next.setDate(next.getDate() + (7 * amount))
    setWeek(keyDate(next))
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `informes-fng-${today}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Respaldo descargado')
  }

  function importBackup(file: File) {
    file.text().then(content => {
      const value: unknown = JSON.parse(content)
      if (!value || typeof value !== 'object' || !('clients' in value) || !('reviews' in value) || !('pending' in value) || !('closed' in value) || !Array.isArray(value.clients) || !Array.isArray(value.reviews) || !Array.isArray(value.pending) || !Array.isArray(value.closed)) throw Error('Formato inválido')
      if (value.reviews.some(item => !item || typeof item !== 'object' || ('actionEntries' in item && (!validReviewActions(item.actionEntries) || item.actionSchemaVersion !== ACTION_SCHEMA_VERSION)))) throw Error('Acciones inválidas')
      if (window.confirm('¿Reemplazar todos los datos por este respaldo?')) {
        setDb(value as Store)
        setNotice('Respaldo restaurado')
      }
    }).catch(() => setError('El respaldo no es válido.'))
  }

  function toggleWeekClosed() {
    const message = closed ? '¿Reabrir esta semana para volver a editarla?' : '¿Cerrar esta semana y bloquear su edición?'
    if (!window.confirm(message)) return
    setDb(currentDb => ({
      ...currentDb,
      closed: closed ? currentDb.closed.filter(item => item !== week) : [...currentDb.closed, week],
    }))
    setNotice(closed ? 'Semana reabierta' : 'Semana cerrada')
  }

  const pageTitles: Record<Tab, { eyebrow: string; title: string; description: string }> = {
    jornada: { eyebrow: 'RESUMEN DIARIO', title: 'Mi jornada', description: 'Organizá las revisiones de hoy y resolvé tus pendientes.' },
    semana: { eyebrow: 'SEGUIMIENTO', title: 'Control semanal', description: 'Registrá el seguimiento diario de cada cliente.' },
    clientes: { eyebrow: 'CARTERA', title: 'Clientes', description: 'Administrá las cuentas que forman parte de tus informes.' },
    informes: { eyebrow: 'ENTREGABLES', title: 'Informes', description: 'Prepará la planilla semanal o un reporte detallado.' },
  }

  const title = pageTitles[tab]

  return <MotionConfig reducedMotion="user"><div className="app-shell">
    <header className="app-navigation screen">
      <div className="wordmark"><span className="wordmark-symbol">f.</span><strong>informes<span>fng</span></strong></div>
      <LayoutGroup id="workspace-navigation"><nav aria-label="Navegación principal">
        {navItems.map(item => <motion.button whileTap={calm ? undefined : { scale: .97 }} key={item.id} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>{tab === item.id ? <motion.span className="navigation-highlight" layoutId="active-navigation" transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }} /> : null}<span className="navigation-icon">{item.id === 'jornada' ? <AnimatedChart active={tab === item.id} /> : <Icon name={item.icon} />}</span><span className="navigation-label">{item.label}</span>{item.id === 'jornada' && pending.length > 0 ? <b>{pending.length}</b> : null}</motion.button>)}
      </nav></LayoutGroup>
      <span className="storage-indicator"><i />{storageMode === 'cloud' ? 'Conectado' : 'En este dispositivo'}</span>
    </header>

    <motion.main className="workspace screen" key={tab} initial={calm ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: calm ? 0 : .24, ease: [0.22, 1, 0.36, 1] }}>
      <header className="page-header">
        <div><span className="eyebrow">{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div>
        <div className="header-actions"><span className="date-chip">{longToday}</span><button className="primary-button" onClick={() => openReview('', today)} disabled={active.length === 0}><Icon name="plus" />Registrar revisión</button></div>
      </header>

      {error ? <div role="alert" className="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Cerrar aviso"><Icon name="close" /></button></div> : null}
      {notice ? <div role="status" className="toast"><Icon name="check" />{notice}</div> : null}

      {tab === 'jornada' ? <>
        <section className="hero-panel">
          <div><span className="section-kicker">PROGRESO DEL DÍA</span><h2>{completion === 100 && active.length ? 'Jornada completa' : 'Seguimiento en curso'}</h2><p>{reviewsToday} de {active.length} clientes activos revisados.</p></div>
          <div className="progress-ring" style={{ '--progress': `${completion * 3.6}deg` } as React.CSSProperties}><span><b>{completion}%</b><small>completo</small></span></div>
        </section>

        <section className="metrics-grid" aria-label="Resumen de la jornada">
          <article><span className="metric-icon success"><Icon name="check" /></span><div><small>Revisados hoy</small><strong>{reviewsToday}</strong><p>Con registro confirmado</p></div></article>
          <article><span className="metric-icon pending"><Icon name="clock" /></span><div><small>Por revisar</small><strong>{Math.max(0, active.length - reviewsToday)}</strong><p>Clientes activos restantes</p></div></article>
          <article><span className="metric-icon neutral"><Icon name="report" /></span><div><small>Pendientes abiertos</small><strong>{pending.length}</strong><p>Acciones para continuar</p></div></article>
        </section>

        <div className="dashboard-grid">
          <section className="panel daily-list">
            <div className="panel-heading"><div><span className="section-kicker">CUENTAS ACTIVAS</span><h2>Revisiones de hoy</h2></div><button className="text-button" onClick={() => navigate('semana')}>Ver semana <Icon name="chevron-right" /></button></div>
            <div className="search-box daily-search"><Icon name="search" /><input type="search" value={dailySearch} onChange={event => setDailySearch(event.target.value)} placeholder="Buscar en tus clientes" aria-label="Buscar en la jornada" /></div>
            {dailyClients.length ? <div className="review-list">{dailyClients.map(clientItem => {
              const reviewItem = findReview(clientItem.id, today)
              return <button key={clientItem.id} className="review-row" onClick={() => openReview(clientItem.id, today)}>
                <span className={`review-state ${reviewItem ? 'done' : ''}`}>{reviewItem ? <Icon name="check" /> : <span />}</span>
                <span className="review-name"><strong>{clientItem.name}</strong><small>{reviewItem ? (describeReviewActions(reviewItem) || reviewItem.observations || 'Revisión registrada') : 'Todavía sin revisar'}</small></span>
                <span className={`state-pill ${reviewItem ? 'done' : ''}`}>{reviewItem ? 'Revisado' : 'Pendiente'}</span>
                <Icon name="chevron-right" />
              </button>
            })}</div> : <EmptyState icon="users" title={active.length ? 'Sin coincidencias' : 'Todavía no hay clientes'} text={active.length ? 'Probá con otro nombre.' : 'Agregá tu primer cliente para comenzar el seguimiento.'} />}
          </section>

          <section className="panel tasks-panel">
            <div className="panel-heading"><div><span className="section-kicker">PRÓXIMAS ACCIONES</span><h2>Mis pendientes</h2></div><span className="count-chip">{pending.length}</span></div>
            {pending.length ? <div className="task-list">{pending.map(item => <div className="task-row" key={item.id}>
              <button className="task-check" onClick={() => resolvePending(item.id)} aria-label={`Completar pendiente: ${item.text}`}><Icon name="check" /></button>
              <div><strong>{db.clients.find(clientItem => clientItem.id === item.clientId)?.name ?? 'Cliente archivado'}</strong><p>{item.text}</p></div>
            </div>)}</div> : <EmptyState icon="check" title="Todo al día" text="Los pendientes que agregues en una revisión aparecerán acá." />}
          </section>
        </div>
      </> : null}

      {tab === 'semana' ? <section className="panel week-panel">
        <div className="panel-heading week-heading"><div><div className="inline-title"><span className="section-kicker">SEMANA DEL</span>{closed ? <span className="closed-badge"><Icon name="lock" size={13} />Cerrada</span> : null}</div><h2>{weekLabel}</h2><p>{inWeek.length} revisiones registradas en este período.</p></div><WeekPicker label={weekLabel} onPrevious={() => changeWeek(-1)} onNext={() => changeWeek(1)} /></div>
        <div className="table-scroll"><table className="week-table"><thead><tr><th>Cliente</th>{days.map((day, index) => <th key={day}><span>{weekdays[index]}</span><small>{format(day)}</small></th>)}</tr></thead><tbody>{active.map(clientItem => <tr key={clientItem.id}><th><span className="client-avatar">{clientItem.name.slice(0, 2)}</span><strong>{clientItem.name}</strong></th>{days.map(day => {
          const reviewItem = findReview(clientItem.id, day)
          return <td key={day}><button disabled={closed} className={reviewItem ? 'reviewed' : ''} onClick={() => openReview(clientItem.id, day)} aria-label={`Revisión de ${clientItem.name} para ${day}`}>{reviewItem ? <Icon name="check" /> : <Icon name="plus" size={15} />}</button></td>
        })}</tr>)}</tbody></table></div>
        {!active.length ? <EmptyState icon="users" title="No hay clientes activos" text="Reactivá o agregá un cliente para completar la semana." /> : null}
        <div className="panel-footer"><p><span className="legend-dot reviewed" />Revisado <span className="legend-dot" />Sin revisar</p><div><button className="secondary-button" onClick={toggleWeekClosed}><Icon name={closed ? 'unlock' : 'lock'} />{closed ? 'Reabrir semana' : 'Cerrar semana'}</button><button className="primary-button" onClick={() => { setPrintMode('grilla'); navigate('informes') }}><Icon name="print" />Preparar informe</button></div></div>
      </section> : null}

      {tab === 'clientes' ? <>
        <section className="panel client-toolbar">
          <form className="add-client" onSubmit={addClient}><label htmlFor="new-client">Nuevo cliente</label><div><input id="new-client" value={newName} onChange={event => setNewName(event.target.value)} placeholder="Nombre de la empresa" /><button className="primary-button" type="submit" disabled={!newName.trim()}><Icon name="plus" />Agregar cliente</button></div></form>
          <div className="backup-actions"><span>Respaldo de datos</span><div><button className="secondary-button" onClick={exportBackup}><Icon name="download" />Exportar</button><label className="secondary-button file-button"><Icon name="upload" />Importar<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) importBackup(file); event.target.value = '' }} /></label></div></div>
        </section>

        <section className="panel clients-panel">
          <div className="clients-controls"><div className="search-box"><Icon name="search" /><input value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" /></div><div className="segmented" aria-label="Filtrar clientes">{(['activos', 'archivados', 'todos'] as ClientFilter[]).map(filter => <button key={filter} className={clientFilter === filter ? 'active' : ''} onClick={() => setClientFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div></div>
          <div className="client-list-header"><span>Cliente</span><span>Actividad</span><span>Estado</span><span>Acciones</span></div>
          {filteredClients.length ? <div className="client-management-list">{filteredClients.map(clientItem => {
            const reviewCount = db.reviews.filter(item => item.clientId === clientItem.id).length
            const pendingCount = db.pending.filter(item => item.clientId === clientItem.id && !item.resolved).length
            return <article key={clientItem.id} className="client-management-row">
              <div className="client-identity"><span className="client-avatar large">{clientItem.name.slice(0, 2)}</span><div><strong>{clientItem.name}</strong><small>Agregado a la cartera FNG</small></div></div>
              <div className="client-stats"><span><b>{reviewCount}</b> revisiones</span><span><b>{pendingCount}</b> pendientes</span></div>
              <span className={`state-pill ${clientItem.active ? 'done' : 'archived'}`}>{clientItem.active ? 'Activo' : 'Archivado'}</span>
              <div className="row-actions"><button className="icon-button" onClick={() => toggleClient(clientItem)} title={clientItem.active ? 'Archivar' : 'Reactivar'} aria-label={clientItem.active ? `Archivar ${clientItem.name}` : `Reactivar ${clientItem.name}`}><Icon name="archive" /></button><button className="icon-button danger-icon" onClick={() => deleteClient(clientItem)} title="Eliminar" aria-label={`Eliminar ${clientItem.name}`}><Icon name="trash" /></button></div>
            </article>
          })}</div> : <EmptyState icon="search" title="Sin resultados" text="Probá otro nombre o cambiá el filtro seleccionado." />}
        </section>
      </> : null}

      {tab === 'informes' ? <div className="reports-layout">
        <section className="panel report-controls">
          <div><span className="section-kicker">PERÍODO</span><h2>Semana del {weekLabel}</h2></div>
          <WeekPicker label={weekLabel} onPrevious={() => changeWeek(-1)} onNext={() => changeWeek(1)} />
          <div className="report-mode"><span className="section-kicker">FORMATO DEL INFORME</span><button className={printMode === 'grilla' ? 'active' : ''} onClick={() => setPrintMode('grilla')}><span><Icon name="calendar" /></span><div><strong>Planilla semanal</strong><small>Matriz de clientes por día</small></div><i>{printMode === 'grilla' ? <Icon name="check" size={14} /> : null}</i></button><button className={printMode === 'detalle' ? 'active' : ''} onClick={() => setPrintMode('detalle')}><span><Icon name="report" /></span><div><strong>Informe detallado</strong><small>Acciones y observaciones</small></div><i>{printMode === 'detalle' ? <Icon name="check" size={14} /> : null}</i></button></div>
          <div className="report-summary"><div><span>Revisiones</span><strong>{inWeek.length}</strong></div><div><span>Clientes cubiertos</span><strong>{new Set(inWeek.map(item => item.clientId)).size}</strong></div><div><span>Pendientes</span><strong>{pending.length}</strong></div></div>
          <button className="primary-button print-button" onClick={() => window.print()}><Icon name="print" />Imprimir o guardar PDF</button>
          <p className="helper-text">El navegador abrirá el diálogo de impresión. Elegí “Guardar como PDF” para generar el archivo.</p>
        </section>

        <section className="report-preview-wrap"><div className="preview-label"><span>Vista previa</span><span>A4 vertical</span></div><div className="report-preview">
          <header><div className="report-brand"><span>F</span><div><strong>INFORMES FNG</strong><small>SEGUIMIENTO PUBLICITARIO</small></div></div><div><small>SEMANA</small><strong>{weekLabel}</strong></div></header>
          {printMode === 'grilla' ? <table><thead><tr><th>CLIENTE</th>{days.map((day, index) => <th key={day}>{weekdays[index]}<small>{format(day)}</small></th>)}</tr></thead><tbody>{active.map(clientItem => <tr key={clientItem.id}><td>{clientItem.name}</td>{days.map(day => <td key={day}>{findReview(clientItem.id, day) ? <Icon name="check" size={13} /> : null}</td>)}</tr>)}</tbody></table> : <div className="detail-preview"><p className="report-lead">{inWeek.length} revisiones realizadas durante el período.</p>{db.clients.map(clientItem => {
            const entries = inWeek.filter(item => item.clientId === clientItem.id).sort((a, b) => a.date.localeCompare(b.date))
            return entries.length ? <section key={clientItem.id}><h3>{clientItem.name}</h3>{entries.map(item => <article key={item.id}><b>{format(item.date)}</b><p><strong>Acciones:</strong> {describeReviewActions(item) || 'Sin modificaciones registradas.'}</p><p><strong>Observaciones:</strong> {item.observations || 'Sin observaciones registradas.'}</p></article>)}</section> : null
          })}{!inWeek.length ? <EmptyState icon="report" title="Sin revisiones" text="Todavía no hay actividad registrada para esta semana." /> : null}<section><h3>Pendientes abiertos</h3>{pending.length ? pending.map(item => <p key={item.id}><strong>{db.clients.find(clientItem => clientItem.id === item.clientId)?.name}:</strong> {item.text}</p>) : <p>Sin pendientes abiertos.</p>}</section></div>}
          <footer><span>Documento de seguimiento interno</span><span>Generado el {new Date().toLocaleDateString('es-AR')}</span></footer>
        </div></section>
      </div> : null}
    </motion.main>

    {selected ? <dialog ref={dialogRef} className={`review-modal screen ${closingReview ? 'is-closing' : ''}`} aria-labelledby="review-title" onCancel={event => { event.preventDefault(); closeReview() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeReview() } }}>
        <header><div><span className="section-kicker">REVISIÓN · {format(selected.day)}</span><h2 id="review-title">{client?.name ?? 'Nueva revisión'}</h2><p>Una revisión también cuenta si no hiciste cambios.</p></div><button className="icon-button" onClick={() => closeReview()} aria-label="Cerrar"><Icon name="close" /></button></header>
        <label>Cliente<select value={selected.id} onChange={event => { if ((actions || observations || pendingText || actionEntries.length) && !window.confirm('¿Cambiar de cliente y descartar lo que estás escribiendo?')) return; openReview(event.target.value, selected.day) }}><option value="" disabled>Elegí un cliente</option>{active.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <QuickActions value={actionEntries} onChange={setActionEntries} />
        <label>Otros detalles<textarea rows={2} value={actions} onChange={event => setActions(event.target.value)} placeholder="Algo más que quieras registrar…" /></label>
        <label>Observaciones<textarea rows={4} value={observations} onChange={event => setObservations(event.target.value)} placeholder="Qué detectaste y qué conviene seguir…" /></label>
        <div className="pending-entry"><label htmlFor="pending-note">Nuevo pendiente</label><div><input id="pending-note" value={pendingText} onChange={event => setPendingText(event.target.value)} placeholder="Ej.: revisar CPA el jueves" /><button className="secondary-button" onClick={addPending} disabled={!client || !pendingText.trim()}><Icon name="plus" />Agregar</button></div></div>
        <footer>{current ? <button className="danger-button" onClick={removeReview}><Icon name="trash" />Quitar revisión</button> : <span />}<div><button className="secondary-button" onClick={() => closeReview()}>Cancelar</button><button className="primary-button" disabled={!client || closingReview} onClick={saveReview}><Icon name="check" />Guardar revisión</button></div></footer>
    </dialog> : null}

    <div className="print-paper">
      <header><div className="print-brand"><span>F</span><div><h1>INFORMES FNG</h1><p>Seguimiento publicitario semanal</p></div></div><div><small>SEMANA</small><strong>{weekLabel}</strong></div></header>
      {printMode === 'grilla' ? <table className="paper-grid"><thead><tr><th>CLIENTE</th>{days.map((day, index) => <th key={day}>{weekdays[index]}<small>{format(day)}</small></th>)}</tr></thead><tbody>{active.map(clientItem => <tr key={clientItem.id}><td>{clientItem.name}</td>{days.map(day => <td key={day}>{findReview(clientItem.id, day) ? '✓' : ''}</td>)}</tr>)}</tbody></table> : <div className="paper-detail"><p>{inWeek.length} revisiones realizadas</p>{db.clients.map(clientItem => {
        const entries = inWeek.filter(item => item.clientId === clientItem.id).sort((a, b) => a.date.localeCompare(b.date))
        return entries.length ? <section key={clientItem.id}><h2>{clientItem.name}</h2>{entries.map(item => <article key={item.id}><b>{format(item.date)}</b><p><strong>Acciones: </strong>{describeReviewActions(item) || 'Sin modificaciones registradas.'}</p><p><strong>Observaciones: </strong>{item.observations || 'Sin observaciones registradas.'}</p></article>)}</section> : null
      })}<h2>Pendientes abiertos</h2>{pending.length ? pending.map(item => <p key={item.id}><strong>{db.clients.find(clientItem => clientItem.id === item.clientId)?.name}:</strong> {item.text}</p>) : <p>Sin pendientes abiertos.</p>}</div>}
      <footer><span>Documento de seguimiento interno</span><span>Generado el {new Date().toLocaleDateString('es-AR')}</span></footer>
    </div>
  </div></MotionConfig>
}
