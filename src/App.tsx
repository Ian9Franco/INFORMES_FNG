'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react'
import ThemeToggle from './components/ThemeToggle'
import useConfirmation from './components/useConfirmation'
import ClientPicker from './components/ClientPicker'
import NotebookReport from './components/NotebookReport'
import { reconcileAccounts } from './account-catalog'
import { newClient, sortClients } from './clients'
import { ExternalLink } from 'lucide-react'
import { monthBounds, samePayload } from './sync/records'
import CompanionAccess from './components/CompanionAccess'
import QuickActions from './components/QuickActions'
import ReviewDetailsFields from './components/ReviewDetailsFields'
import RapidReviewSection from './components/RapidReviewSection'
import NotebookPage from './components/NotebookPage'
import { draftChanged, draftKey, nextPendingClient, readDrafts, reviewSignature, type ReviewDrafts } from './review-workflow'
import { AnimatedChart } from './components/AnimatedSymbols'
import { ACTION_SCHEMA_VERSION, describeReviewActions, storyDaysLabel, validReviewActions, type CustomAction, validCustomAction, type ReviewAction } from './review-actions'
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

export default function App({ initialData, onChange, storageMode = 'local', userId, onPeriodChange, onExport, onImport, headerTools, readOnly = false }: { readOnly?: boolean; headerTools?: React.ReactNode; initialData?: Store; onChange?: (data: Store) => void; storageMode?: 'local' | 'cloud'; userId?: string; onPeriodChange?: (start: string, end: string) => void; onExport?: () => Promise<Store>; onImport?: (store: Store) => Promise<void> }) {
  const [db, setDbState] = useState<Store>(() => { const store = reconcileAccounts(initialData ?? load()); return { ...store, clients: sortClients(store.clients) } })
  const { confirm, confirmation } = useConfirmation()
  const dbRef = useRef(db)
  dbRef.current = db
  const firstPersistence = useRef(true)
  function setDb(update: Store | ((current: Store) => Store)) {
    const next = typeof update === 'function' ? update(dbRef.current) : update
    dbRef.current = next
    setDbState(next)
    // Persist to the durable outbox in the event handler, before any remote render.
    onChange?.(next)
  }
  const [tab, setTab] = useState<Tab>('jornada')
  const [direction, setDirection] = useState(1)
  const [turningPage, setTurningPage] = useState(false)
  const [week, setWeek] = useState(() => monday(new Date()))
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month'>('week')
  const [reportMonth, setReportMonth] = useState(() => keyDate(new Date()).slice(0, 7))
  const remoteRef = useRef(initialData)
  const formRevision = useRef<number | undefined>(undefined)
  const [selected, setSelected] = useState<{ id: string; day: string; mode: 'inline' | 'modal' } | null>(null)
  const formBase = useRef<Review | undefined>(undefined)
  const draftStorageKey = `fng-review-drafts:v1:${userId ?? 'local'}`
  const [drafts, setDrafts] = useState<ReviewDrafts>(() => { try { return readDrafts(localStorage, draftStorageKey) } catch { return {} } })
  const draftsRef = useRef(drafts)
  const [undoReview, setUndoReview] = useState<Review | null>(null)
  const [actions, setActions] = useState('')
  const [actionEntries, setActionEntries] = useState<ReviewAction[]>([])
  const calm = useReducedMotion()
  const [observations, setObservations] = useState('')
  const [pendingText, setPendingText] = useState('')
  const [newName, setNewName] = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [newClientError, setNewClientError] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('activos')
  const [printMode, setPrintMode] = useState<PrintMode>('grilla')
  const [reportTitle, setReportTitle] = useState(() => { try { return localStorage.getItem('informe-fng-report-title') || 'Informe Ian' } catch { return 'Informe Ian' } })
  const [exportingImage, setExportingImage] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dailySearch, setDailySearch] = useState('')
  const [dailyFilter, setDailyFilter] = useState<'todos' | 'pendientes' | 'revisados'>('todos')
  const [showActivity, setShowActivity] = useState(false)
  const [closingReview, setClosingReview] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const saveBarRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollPositions = useRef<Partial<Record<Tab, number>>>({})
  const selectedOpen = selected?.mode === 'modal'
  const documentTitle = reportTitle.trim() || 'Informe Ian'

  useEffect(() => { try { localStorage.setItem('informe-fng-report-title', reportTitle) } catch { /* Title remains usable without storage. */ } }, [reportTitle])

  const today = keyDate(new Date())
  const days = weekDays(week)
  const clients = useMemo(() => sortClients(db.clients), [db.clients])
  const active = clients.filter(clientItem => clientItem.active)
  const closed = db.closed.includes(week)
  const inWeek = db.reviews.filter(reviewItem => days.includes(reviewItem.date))
  const monthRange = monthBounds(reportMonth)
  const reportReviews = reportPeriod === 'month' ? db.reviews.filter(review => review.date >= monthRange.start && review.date < monthRange.end) : inWeek
  const pending = db.pending.filter(item => !item.resolved)
  const reviewsToday = active.filter(clientItem => db.reviews.some(reviewItem => reviewItem.clientId === clientItem.id && reviewItem.date === today)).length
  const completion = active.length ? Math.round((reviewsToday / active.length) * 100) : 0
  const current = selected ? db.reviews.find(reviewItem => reviewItem.clientId === selected.id && reviewItem.date === selected.day) : undefined
  const client = selected ? db.clients.find(clientItem => clientItem.id === selected.id) : undefined
  const weekLabel = `${format(days[0])} al ${format(days[5])} de ${date(days[5]).getFullYear()}`
  const reportLabel = reportPeriod === 'month' ? new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date(monthRange.start)) : `Semana del ${weekLabel}`
  const longToday = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const dailyClients = active.filter(item => item.name.toLocaleLowerCase('es').includes(dailySearch.trim().toLocaleLowerCase('es')) && (dailyFilter === 'todos' || db.reviews.some(review => review.clientId === item.id && review.date === today) === (dailyFilter === 'revisados')))

  function updateDraft(key: string, draft: ReviewDrafts[string] | null) {
    if (!draft && !draftsRef.current[key]) return
    const next = { ...draftsRef.current }
    if (draft) next[key] = draft
    else delete next[key]
    draftsRef.current = next
    setDrafts(next)
    try { localStorage.setItem(draftStorageKey, JSON.stringify(next)) } catch { setError('El borrador sigue en esta pantalla, pero no pudo guardarse en el dispositivo. Guardá la revisión antes de salir.') }
  }

  function stashDraft() {
    if (!selected || closingReview) return
    const draft = { clientId: selected.id, day: selected.day, base: formBase.current, actions, observations, actionEntries, pendingText, updatedAt: new Date().toISOString() }
    if (selected.id) updateDraft(draftKey(selected.id, selected.day), draftChanged(draft) ? draft : null)
  }

  useEffect(() => { stashDraft() }, [selected, actions, observations, actionEntries, pendingText, closingReview])
  useEffect(() => {
    if (!undoReview) return
    const timer = setTimeout(() => setUndoReview(null), 8000)
    return () => clearTimeout(timer)
  }, [undoReview])

  useEffect(() => {
    if (!initialData || initialData === remoteRef.current) return
    remoteRef.current = initialData
    dbRef.current = initialData
    setDbState(initialData)
  }, [initialData])

  useEffect(() => {
    const periodWeek = tab === 'jornada' ? monday(new Date()) : week
    const end = date(periodWeek); end.setDate(end.getDate() + 7)
    if (tab === 'informes' && reportPeriod === 'month') onPeriodChange?.(monthRange.start, monthRange.end)
    else onPeriodChange?.(periodWeek, keyDate(end))
  }, [tab, week, reportPeriod, reportMonth, onPeriodChange])

  function navigate(next: Tab) {
    if (next === tab || turningPage) return
    if (rowScrollTimer.current) clearTimeout(rowScrollTimer.current)
    if (selected?.mode === 'inline') { stashDraft(); setSelected(null) }
    scrollPositions.current[tab] = window.scrollY
    setDirection(navItems.findIndex(item => item.id === next) > navItems.findIndex(item => item.id === tab) ? 1 : -1)
    setTurningPage(!calm)
    setTab(next)
  }

  function closeReview(force = false) {
    if (closingReview) return
    if (rowScrollTimer.current) clearTimeout(rowScrollTimer.current)
    if (!force) stashDraft()
    if (selected?.mode === 'inline') { setSelected(null); return }
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

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); if (rowScrollTimer.current) clearTimeout(rowScrollTimer.current) }, [])
  useEffect(() => {
    if (selected?.mode !== 'inline') return
    const viewport = window.visualViewport
    const adjust = () => { if (viewport?.scale === 1) saveBarRef.current?.style.setProperty('--rapid-keyboard-inset', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`) }
    adjust()
    viewport?.addEventListener('resize', adjust)
    viewport?.addEventListener('scroll', adjust)
    return () => { viewport?.removeEventListener('resize', adjust); viewport?.removeEventListener('scroll', adjust) }
  }, [selected?.mode])

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase('es')
    return clients.filter(clientItem => {
      const matchesState = clientFilter === 'todos' || (clientFilter === 'activos' ? clientItem.active : !clientItem.active)
      const searchable = `${clientItem.name} ${clientItem.advertisingAccounts?.map(account => `${account.owner} ${account.accountId}`).join(' ') ?? ''}`.toLocaleLowerCase('es')
      return matchesState && (!query || searchable.includes(query))
    })
  }, [clientFilter, clientSearch, clients])

  useEffect(() => {
    try {
      if (!userId) persist(db)
      if (firstPersistence.current) { firstPersistence.current = false; onChange?.(db) }
      setError('')
    } catch {
      setError('No se pudieron guardar los datos. Exportá una copia de seguridad.')
    }
  }, [db, onChange, userId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function findReview(clientId: string, day: string) {
    return db.reviews.find(reviewItem => reviewItem.clientId === clientId && reviewItem.date === day)
  }

  function openReview(clientId: string, day: string, mode: 'inline' | 'modal' = 'modal', discardDraft = false) {
    if (db.closed.includes(monday(date(day)))) {
      setNotice('Semana cerrada. Reabrila desde Semana para editar.')
      return
    }
    stashDraft()
    if (discardDraft) updateDraft(draftKey(clientId, day), null)
    const reviewItem = dbRef.current.reviews.find(item => item.clientId === clientId && item.date === day)
    const draft = discardDraft ? undefined : draftsRef.current[draftKey(clientId, day)]
    formBase.current = draft ? draft.base : reviewItem
    formRevision.current = formBase.current?.revision
    setSelected({ id: clientId, day, mode })
    setActions(draft?.actions ?? reviewItem?.actions ?? '')
    setActionEntries(draft?.actionEntries ?? (validReviewActions(reviewItem?.actionEntries) ? reviewItem.actionEntries : []))
    setObservations(draft?.observations ?? reviewItem?.observations ?? '')
    setPendingText(draft?.pendingText ?? '')
    if (mode === 'inline') {
      if (rowScrollTimer.current) clearTimeout(rowScrollTimer.current)
      rowScrollTimer.current = setTimeout(() => document.querySelector<HTMLElement>(`.review-item[data-client-id="${CSS.escape(clientId)}"]`)?.scrollIntoView({ block: 'start', behavior: calm ? 'instant' : 'smooth' }), calm ? 0 : 220)
    }
  }

  function saveReview(andNext = false) {
    if (!selected?.id || closingReview || db.closed.includes(monday(date(selected.day))) || !validReviewActions(actionEntries)) return
    if (actionEntries.some(entry => entry.customDefinition && (entry.customDefinition.scope === 'client' && entry.customDefinition.clientId !== selected.id || !dbRef.current.customActions?.some(definition => definition.id === entry.typeId)))) { setError('Una acción no está disponible para este cliente. Quitala y seleccioná una del catálogo.'); return }
    const previous = dbRef.current.reviews.find(item => item.clientId === selected.id && item.date === selected.day)
    if (previous?.revision !== formRevision.current || reviewSignature(previous) !== reviewSignature(formBase.current)) { setNotice('Esta revisión cambió en otro dispositivo. Tu borrador está conservado; copiá tus notas y cargá la versión actual antes de guardar.'); return }
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
      pending: pendingText.trim() ? [...currentDb.pending, { id: uid(), clientId: selected.id, text: pendingText.trim(), resolved: false }] : currentDb.pending,
    }))
    updateDraft(draftKey(selected.id, selected.day), null)
    const next = andNext ? nextPendingClient(tab === 'jornada' ? dailyClients : active, dbRef.current.reviews, selected.day, selected.id) : undefined
    if (next) {
      // Reset the saved form before opening the next client; never re-stash it.
      const draft = draftsRef.current[draftKey(next.id, selected.day)]
      formBase.current = draft?.base
      formRevision.current = draft?.base?.revision
      setSelected({ ...selected, id: next.id })
      setActions(draft?.actions ?? ''); setObservations(draft?.observations ?? '')
      setActionEntries(draft?.actionEntries ?? []); setPendingText(draft?.pendingText ?? '')
      if (selected.mode === 'inline') {
        if (rowScrollTimer.current) clearTimeout(rowScrollTimer.current)
        rowScrollTimer.current = setTimeout(() => {
        const row = document.querySelector<HTMLElement>(`.review-item[data-client-id="${CSS.escape(next.id)}"]`)
        row?.scrollIntoView({ block: 'start', behavior: calm ? 'instant' : 'smooth' })
        row?.querySelector<HTMLButtonElement>('.review-row')?.focus({ preventScroll: true })
        }, calm ? 0 : 220)
      }
      else if (dialogRef.current) dialogRef.current.querySelector('.review-modal-body')?.scrollTo({ top: 0 })
    } else closeReview(true)
    setNotice(previous ? 'Revisión actualizada' : 'Revisión registrada')
  }

  function reviewWithoutChanges(clientId: string) {
    if (dbRef.current.closed.includes(monday(date(today))) || dbRef.current.reviews.some(item => item.clientId === clientId && item.date === today) || draftsRef.current[draftKey(clientId, today)]) return
    const item: Review = { id: uid(), clientId, date: today, createdAt: new Date().toISOString(), actions: '', observations: '', actionSchemaVersion: ACTION_SCHEMA_VERSION, actionEntries: [] }
    setDb(currentDb => ({ ...currentDb, reviews: [...currentDb.reviews, item] }))
    setUndoReview(item)
  }

  function undoQuickReview() {
    if (!undoReview) return
    const latest = dbRef.current.reviews.find(item => item.id === undoReview.id)
    if (dbRef.current.closed.includes(monday(date(undoReview.date))) || reviewSignature(latest) !== reviewSignature(undoReview)) { setNotice('La revisión cambió o la semana se cerró. No se deshizo para conservar ese cambio.'); setUndoReview(null); return }
    setDb(currentDb => ({ ...currentDb, reviews: currentDb.reviews.filter(item => item.id !== undoReview.id) }))
    setUndoReview(null); setNotice('Revisión sin cambios deshecha')
  }

  async function removeReview() {
    if (!current) return
    if (!await confirm({ title: '¿Quitar esta revisión?', message: 'Las acciones y observaciones asociadas también se eliminarán.', accept: 'Eliminar revisión', danger: true })) return
    if (reviewSignature(dbRef.current.reviews.find(item => item.id === current.id)) !== reviewSignature(current) || dbRef.current.closed.includes(monday(date(current.date)))) { setError('La revisión cambió o la semana se cerró. Volvé a abrirla antes de eliminar.'); return }
    setDb(currentDb => ({ ...currentDb, reviews: currentDb.reviews.filter(reviewItem => reviewItem.id !== current.id) }))
    if (selected) updateDraft(draftKey(selected.id, selected.day), null)
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

  function reviewShortcut(event: React.KeyboardEvent) {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.nativeEvent.isComposing) return
    event.preventDefault(); saveReview(event.shiftKey)
  }

  async function reloadReview() {
    if (selected && await confirm({ title: '¿Descartar el borrador?', message: 'Se cargará la revisión actual. Copiá antes las notas que quieras conservar.', accept: 'Cargar revisión' })) openReview(selected.id, selected.day, selected.mode, true)
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
    try {
      const client = newClient(db.clients, newName, newAccountId)
      setDb(currentDb => ({ ...currentDb, clients: sortClients([...currentDb.clients, client]) }))
      setNewName('')
      setNewAccountId('')
      setNewClientError('')
      setNotice('Cliente agregado con su cuenta publicitaria')
    } catch (error) {
      setNewClientError(error instanceof Error ? error.message : 'No se pudo agregar el cliente.')
    }
  }

  function toggleClient(clientItem: Client) {
    setDb(currentDb => ({
      ...currentDb,
      clients: currentDb.clients.map(item => item.id === clientItem.id ? { ...item, active: !item.active } : item),
    }))
    setNotice(clientItem.active ? 'Cliente archivado' : 'Cliente reactivado')
  }

  async function deleteClient(clientItem: Client) {
    const hasHistory = db.reviews.some(item => item.clientId === clientItem.id) || db.pending.some(item => item.clientId === clientItem.id) || db.customActions?.some(item => item.clientId === clientItem.id)
    if (hasHistory) {
      setError('Este cliente tiene historial o acciones propias. Podés archivarlo para conservar sus datos.')
      return
    }
    if (!await confirm({ title: '¿Eliminar cliente?', message: `${clientItem.name} se eliminará definitivamente. Podés archivarlo si preferís conservarlo.`, accept: 'Eliminar cliente', danger: true })) return
    if (dbRef.current.reviews.some(item => item.clientId === clientItem.id) || dbRef.current.pending.some(item => item.clientId === clientItem.id) || dbRef.current.customActions?.some(item => item.clientId === clientItem.id)) { setError('Este cliente ahora tiene historial o acciones propias. Archivá en lugar de eliminar.'); return }
    setDb(currentDb => ({ ...currentDb, clients: currentDb.clients.filter(item => item.id !== clientItem.id) }))
    setNotice('Cliente eliminado')
  }

  function changeWeek(amount: number) {
    const next = date(week)
    next.setDate(next.getDate() + (7 * amount))
    setWeek(keyDate(next))
  }

  async function exportBackup() {
    let snapshot: Store
    try { snapshot = onExport ? await onExport() : db } catch { setError('No se pudo descargar el respaldo completo. Revisá la conexión.'); return }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `informes-fng-${today}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Respaldo descargado')
  }

  async function downloadPng() {
    if (exportingImage) return
    const paper = document.querySelector<HTMLElement>('.print-paper .notebook-report')
    if (!paper) return
    setExportingImage(true)
    try {
      await document.fonts.ready
      const { toPng } = await import('html-to-image')
      const image = await toPng(paper, { pixelRatio: 3.125, backgroundColor: '#ffffff', skipFonts: true })
      const anchor = document.createElement('a')
      anchor.download = `${documentTitle.replace(/[<>:"/\\|?*]/g, '-')} - ${reportPeriod === 'month' ? reportMonth : week} - ${printMode === 'grilla' ? 'semanal' : 'detallado'}.png`
      anchor.href = image
      anchor.click()
      setNotice('Informe PNG descargado')
    } catch {
      setError('No se pudo generar la imagen. Intentá descargarla nuevamente.')
    } finally { setExportingImage(false) }
  }

  function importBackup(file: File) {
    file.text().then(async content => {
      const value: unknown = JSON.parse(content)
      if (!value || typeof value !== 'object' || !('clients' in value) || !('reviews' in value) || !('pending' in value) || !('closed' in value) || !Array.isArray(value.clients) || !Array.isArray(value.reviews) || !Array.isArray(value.pending) || !Array.isArray(value.closed)) throw Error('Formato inválido')
      if ('customActions' in value && (!Array.isArray(value.customActions) || !value.customActions.every(validCustomAction))) throw Error('Catálogo inválido')
      if (value.reviews.some(item => !item || typeof item !== 'object' || ('actionEntries' in item && (!validReviewActions(item.actionEntries) || item.actionSchemaVersion !== ACTION_SCHEMA_VERSION)))) throw Error('Acciones inválidas')
      if (await confirm({ title: '¿Restaurar respaldo?', message: 'Se reemplazarán todos tus datos por este archivo. Descargá una copia actual antes de continuar.', accept: 'Reemplazar datos', danger: true })) {
        const store = reconcileAccounts(value as Store)
        // Old backups must not tombstone immutable definitions or orphan their clients.
        const catalog = new Map((dbRef.current.customActions ?? []).map(item => [item.id, item]))
        for (const definition of store.customActions ?? []) {
          if (catalog.has(definition.id) && !samePayload(catalog.get(definition.id), definition)) throw Error('Definición histórica alterada')
          catalog.set(definition.id, definition)
        }
        store.customActions = [...catalog.values()]
        for (const definition of store.customActions) if (definition.clientId && !store.clients.some(item => item.id === definition.clientId)) {
          const client = dbRef.current.clients.find(item => item.id === definition.clientId)
          if (client) store.clients.push({ ...client, active: false })
          else throw Error('Cliente de acción inexistente')
        }
        if (onImport) await onImport(store)
        else setDb({ ...store, clients: sortClients(store.clients) })
        setNotice('Respaldo restaurado')
      }
    }).catch(() => setError('El respaldo no es válido.'))
  }

  async function toggleWeekClosed() {
    const message = closed ? '¿Reabrir esta semana para volver a editarla?' : '¿Cerrar esta semana y bloquear su edición?'
    if (!await confirm({ title: closed ? 'Reabrir semana' : 'Cerrar semana', message, accept: closed ? 'Reabrir' : 'Cerrar semana' })) return
    setDb(currentDb => ({
      ...currentDb,
      closed: closed ? currentDb.closed.filter(item => item !== week) : [...currentDb.closed, week],
    }))
    setNotice(closed ? 'Semana reabierta' : 'Semana cerrada')
  }

  function createAction(definition: CustomAction) {
    setDb(currentDb => ({ ...currentDb, customActions: [...(currentDb.customActions ?? []), definition] }))
    setNotice(definition.scope === 'client' ? 'Acción creada sólo para este cliente' : 'Acción creada para todos tus clientes')
  }

  const pageTitles: Record<Tab, { eyebrow: string; title: string; description: string }> = {
    jornada: { eyebrow: 'RESUMEN DIARIO', title: 'Mi jornada', description: 'Organizá las revisiones de hoy y resolvé tus pendientes.' },
    semana: { eyebrow: 'SEGUIMIENTO', title: 'Control semanal', description: 'Registrá el seguimiento diario de cada cliente.' },
    clientes: { eyebrow: 'CARTERA', title: 'Clientes', description: 'Administrá las cuentas que forman parte de tus informes.' },
    informes: { eyebrow: 'ENTREGABLES', title: 'Informes', description: 'Prepará la planilla semanal o un reporte detallado.' },
  }

  const title = pageTitles[tab]

  return <MotionConfig reducedMotion="user"><div className="app-shell">{confirmation}
    <header className="app-navigation screen">
      <div className="wordmark"><span className="wordmark-symbol">f.</span><div><strong>Informes FNG</strong><small>Mi libreta de trabajo</small></div></div>
      <LayoutGroup id="workspace-navigation"><nav aria-label="Navegación principal">
        {navItems.map(item => <motion.button whileHover={calm ? undefined : { scale: 1.035 }} whileTap={calm ? undefined : { scaleX: 1.06, scaleY: .9 }} transition={{ type: 'spring', stiffness: 450, damping: 18, mass: .55 }} key={item.id} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>{tab === item.id ? <motion.span className="navigation-highlight" layoutId="active-navigation" transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }} /> : null}<span className="navigation-icon">{item.id === 'jornada' ? <AnimatedChart active={tab === item.id} /> : <Icon name={item.icon} />}</span><span className="navigation-label">{item.label}</span>{item.id === 'jornada' && pending.length > 0 ? <b>{pending.length}</b> : null}</motion.button>)}
      </nav></LayoutGroup>
      <div className="navigation-tools"><ThemeToggle />{headerTools ?? <span className="storage-indicator">Guardado local</span>}</div>
    </header>

    <div className="notebook-pages screen" inert={readOnly}><AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={() => requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[tab] ?? 0, behavior: 'instant' }))}>
    <NotebookPage key={tab} name={tab} side={direction} onEntered={() => setTurningPage(false)}>
      <header className="page-header">
        <div><span className="eyebrow">{title.eyebrow}</span><h1>{title.title}</h1><p>{title.description}</p></div>
        <div className="header-actions"><span className="date-chip">{longToday}</span><button className="primary-button" onClick={() => openReview('', today)} disabled={active.length === 0}><Icon name="plus" />Registrar revisión</button></div>
      </header>

      {error ? <div role="alert" className="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Cerrar aviso"><Icon name="close" /></button></div> : null}
      {notice ? <div role="status" className="toast"><Icon name="check" />{notice}</div> : null}

      {tab === 'jornada' ? <>
        {(db.activity ?? []).some(event => event.status === 'pending' && event.date === today) ? <section className={`panel activity-inbox ${showActivity ? 'is-open' : ''}`}><div className="panel-heading"><div><span className="section-kicker">COMPANION</span><h2>Actividad de tu PC</h2><p>Sesiones observadas; confirmá la revisión para completar el día.</p></div><button type="button" className="text-button" aria-expanded={showActivity} aria-controls="activity-records" onClick={() => setShowActivity(!showActivity)}>{showActivity ? 'Ocultar' : `Ver ${(db.activity ?? []).filter(event => event.status === 'pending' && event.date === today).length}`}<Icon name="chevron-right" size={15} /></button></div><div id="activity-records" hidden={!showActivity}>{(db.activity ?? []).filter(event => event.status === 'pending' && event.date === today).map(event => <article key={event.id}><div><strong>{clients.find(client => client.id === event.clientId)?.name ?? `Cuenta sin vincular: ${event.accountCandidate ?? 'sin ID'}`}</strong><p>{event.platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads'} · {Math.floor(event.focusedMs / 60000)} min estimados · {event.navigationSignals} señales</p></div>{event.clientId ? <button className="secondary-button" onClick={() => openReview(event.clientId!, event.date)}>{findReview(event.clientId, event.date) ? 'Ver revisión' : 'Registrar revisión'}</button> : null}<button className="icon-button" aria-label="Descartar sesión" onClick={() => setDb(currentDb => ({ ...currentDb, activity: currentDb.activity?.map(item => item.id === event.id ? { ...item, status: 'dismissed' } : item) }))}><Icon name="close" /></button></article>)}</div></section> : null}
        <div className="daily-overview"><section className="hero-panel">
          <div><span className="section-kicker">PROGRESO DEL DÍA</span><h2>{completion === 100 && active.length ? 'Jornada completa' : 'Seguimiento en curso'}</h2><p>{reviewsToday} de {active.length} clientes activos revisados.</p></div>
          <div className="progress-ring" style={{ '--progress': `${completion * 3.6}deg` } as React.CSSProperties}><span><b>{completion}%</b><small>completo</small></span></div>
        </section>

        <section className="metrics-grid" aria-label="Resumen de la jornada">
          <article><span className="metric-icon success"><Icon name="check" /></span><div><small>Revisados hoy</small><strong>{reviewsToday}</strong><p>Con registro confirmado</p></div></article>
          <article><span className="metric-icon pending"><Icon name="clock" /></span><div><small>Por revisar</small><strong>{Math.max(0, active.length - reviewsToday)}</strong><p>Clientes activos restantes</p></div></article>
          <article><span className="metric-icon neutral"><Icon name="report" /></span><div><small>Pendientes abiertos</small><strong>{pending.length}</strong><p>Acciones para continuar</p></div></article>
        </section></div>

        <div className="dashboard-grid">
          <section className="panel daily-list">
            <div className="panel-heading"><div><span className="section-kicker">CUENTAS ACTIVAS</span><h2>Revisiones de hoy</h2></div><button className="text-button" onClick={() => navigate('semana')}>Ver semana <Icon name="chevron-right" /></button></div>
            <div className="search-box daily-search"><Icon name="search" /><input type="search" value={dailySearch} onChange={event => { if (selected?.mode === 'inline') closeReview(); setDailySearch(event.target.value) }} placeholder="Buscar en tus clientes" aria-label="Buscar en la jornada" /></div>
            <div className="segmented daily-filter" aria-label="Filtrar revisiones de hoy">{(['todos', 'pendientes', 'revisados'] as const).map(filter => <button key={filter} aria-pressed={dailyFilter === filter} className={dailyFilter === filter ? 'active' : ''} onClick={() => { if (selected?.mode === 'inline') closeReview(); setDailyFilter(filter) }}>{filter === 'todos' ? 'Todos' : filter === 'pendientes' ? 'Por revisar' : 'Revisados'}</button>)}</div>
            {dailyClients.length ? <div className="review-list">{dailyClients.map(clientItem => {
              const reviewItem = findReview(clientItem.id, today)
              const expanded = selected?.mode === 'inline' && selected.id === clientItem.id && selected.day === today
              const hasDraft = Boolean(drafts[draftKey(clientItem.id, today)])
              const dayClosed = db.closed.includes(monday(date(today)))
              return <article key={clientItem.id} data-client-id={clientItem.id} className={`review-item ${expanded ? 'is-expanded' : ''}`}>
              <div className="review-row-header"><button className="review-row" aria-expanded={expanded} aria-controls={`rapid-${clientItem.id}`} onClick={() => expanded ? closeReview() : openReview(clientItem.id, today, 'inline')}>
                <span className={`review-state ${reviewItem ? 'done' : ''}`}>{reviewItem ? <Icon name="check" /> : <span />}</span>
                <span className="review-name"><strong>{clientItem.name}</strong><small>{reviewItem ? `${storyDaysLabel([reviewItem]) ? `Historia → ${storyDaysLabel([reviewItem])} · ` : ''}${storyDaysLabel([reviewItem], true, 'meta.post.scheduled') ? `Publicación → ${storyDaysLabel([reviewItem], true, 'meta.post.scheduled')} · ` : ''}${describeReviewActions(reviewItem) || reviewItem.observations || 'Revisión registrada'}` : 'Todavía sin revisar'}</small></span>
                <span className={`state-pill ${reviewItem ? 'done' : ''}`}>{hasDraft ? 'Borrador' : reviewItem ? 'Revisado' : 'Pendiente'}</span>
                <Icon name="chevron-right" />
              </button>
              <div className="review-row-tools">{!reviewItem ? <button type="button" className="one-touch-review" disabled={dayClosed || hasDraft || expanded} onClick={() => reviewWithoutChanges(clientItem.id)} aria-label={`Revisado sin cambios: ${clientItem.name}`}><Icon name="check" size={15} /><span>Sin cambios</span></button> : null}<button type="button" className="quick-register" disabled={dayClosed} onClick={() => expanded ? closeReview() : openReview(clientItem.id, today, 'inline')} aria-label={`${expanded ? 'Cerrar registro' : reviewItem ? 'Editar revisión' : 'Registrar acciones'}: ${clientItem.name}`}>{expanded ? 'Cerrar' : hasDraft ? 'Continuar' : reviewItem ? 'Editar' : 'Registrar'}</button></div></div>
              <AnimatePresence initial={false}>{expanded ? <RapidReviewSection id={`rapid-${clientItem.id}`} key="editor" label={`Registro rápido de ${clientItem.name}`} onKeyDown={reviewShortcut}>
                <div className="rapid-review-heading"><span>Borrador en este dispositivo · confirmá para completar</span><button type="button" className="text-button" onClick={() => setSelected({ ...selected!, mode: 'modal' })}>Edición detallada <Icon name="chevron-right" size={14} /></button></div>
                {reviewSignature(current) !== reviewSignature(formBase.current) ? <div className="draft-conflict" role="status">La revisión cambió. Conservamos tu borrador.<button type="button" onClick={reloadReview}>Cargar versión actual</button></div> : null}
                <QuickActions clientId={selected?.id} catalog={db.customActions} onCreate={createAction} value={actionEntries} onChange={setActionEntries} compact storageKey={`fng-action-prefs:${userId ?? 'local'}`} />
                <details className="rapid-details"><summary>Notas y pendientes{actions || observations || pendingText ? ' · con contenido' : ' · opcional'}</summary><ReviewDetailsFields actions={actions} observations={observations} pendingText={pendingText} onActions={setActions} onObservations={setObservations} onPending={setPendingText} onAddPending={addPending} /></details>
              </RapidReviewSection> : null}</AnimatePresence>
              </article>
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
        {storageMode === 'cloud' ? <CompanionAccess /> : null}
        <section className="panel client-toolbar">
          <form className="add-client" onSubmit={addClient}><span className="field-label">Nuevo cliente</span><div className="new-client-fields"><label htmlFor="new-client">Nombre<input id="new-client" value={newName} onChange={event => { setNewName(event.target.value); setNewClientError('') }} placeholder="Nombre de la empresa" required maxLength={120} /></label><label htmlFor="new-account-id">ID de cuenta publicitaria (Meta)<input id="new-account-id" type="text" inputMode="numeric" value={newAccountId} onChange={event => { setNewAccountId(event.target.value); setNewClientError('') }} placeholder="Ej.: 2980180415592669" required maxLength={30} aria-describedby="new-client-help" aria-invalid={Boolean(newClientError)} /></label><button className="primary-button" type="submit" disabled={!newName.trim() || !newAccountId.trim()}><Icon name="plus" />Agregar cliente</button></div><p className="new-client-help" id="new-client-help">Copiá el ID de la cuenta en Meta. Se usará para identificar al cliente desde Companion.</p>{newClientError ? <p className="new-client-error" role="alert">{newClientError}</p> : null}</form>
          <div className="backup-actions"><span>Respaldo de datos</span><div><button className="secondary-button" onClick={exportBackup}><Icon name="download" />Exportar</button><label className="secondary-button file-button"><Icon name="upload" />Importar<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) importBackup(file); event.target.value = '' }} /></label></div></div>
        </section>

        <section className="panel clients-panel">
          <div className="clients-controls"><div className="search-box"><Icon name="search" /><input value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" /></div><div className="segmented" aria-label="Filtrar clientes">{(['activos', 'archivados', 'todos'] as ClientFilter[]).map(filter => <button key={filter} className={clientFilter === filter ? 'active' : ''} onClick={() => setClientFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div></div>
          <div className="client-list-header"><span>Cliente</span><span>Actividad</span><span>Estado</span><span>Acciones</span></div>
          {filteredClients.length ? <div className="client-management-list">{filteredClients.map(clientItem => {
            const reviewCount = db.reviews.filter(item => item.clientId === clientItem.id).length
            const pendingCount = db.pending.filter(item => item.clientId === clientItem.id && !item.resolved).length
            return <article key={clientItem.id} className="client-management-row">
              <div className="client-identity"><span className="client-avatar large">{clientItem.name.slice(0, 2)}</span><div><strong>{clientItem.name}</strong>{clientItem.advertisingAccounts?.length ? clientItem.advertisingAccounts.map(account => <small key={account.accountId} className="account-binding"><span>{account.owner}</span><button type="button" title="Copiar ID de cuenta publicitaria" onClick={() => { navigator.clipboard.writeText(account.accountId).then(() => setNotice('ID de cuenta copiado')).catch(() => setError('No se pudo copiar el ID.')) }}>Meta · {account.accountId}</button></small>) : <small>Sin cuenta publicitaria vinculada</small>}</div></div>
              <div className="client-stats"><span><b>{reviewCount}</b> revisiones</span><span><b>{pendingCount}</b> pendientes</span></div>
              <span className={`state-pill ${clientItem.active ? 'done' : 'archived'}`}>{clientItem.active ? 'Activo' : 'Archivado'}</span>
              <div className="row-actions"><button className="icon-button" onClick={() => toggleClient(clientItem)} title={clientItem.active ? 'Archivar' : 'Reactivar'} aria-label={clientItem.active ? `Archivar ${clientItem.name}` : `Reactivar ${clientItem.name}`}><Icon name="archive" /></button><button className="icon-button danger-icon" onClick={() => deleteClient(clientItem)} title="Eliminar" aria-label={`Eliminar ${clientItem.name}`}><Icon name="trash" /></button></div>
            </article>
          })}</div> : <EmptyState icon="search" title="Sin resultados" text="Probá otro nombre o cambiá el filtro seleccionado." />}
        </section>
      </> : null}

      {tab === 'informes' ? <div className="reports-layout">
        <section className="panel report-controls">
          <div><span className="section-kicker">PERÍODO</span><h2>{reportLabel}</h2></div>
          <div className="segmented" aria-label="Período del informe"><button className={reportPeriod === 'week' ? 'active' : ''} onClick={() => setReportPeriod('week')}>Semanal</button><button className={reportPeriod === 'month' ? 'active' : ''} onClick={() => setReportPeriod('month')}>Histórico mensual</button></div>
          {reportPeriod === 'week' ? <WeekPicker label={weekLabel} onPrevious={() => changeWeek(-1)} onNext={() => changeWeek(1)} /> : <label className="report-title-label">Mes<input type="month" className="report-title-input" value={reportMonth} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setReportMonth(event.target.value) }} /></label>}
          <label className="report-title-label" htmlFor="report-title">Título del documento<input className="report-title-input" id="report-title" value={reportTitle} maxLength={80} onChange={event => setReportTitle(event.target.value)} placeholder="Informe Ian" /></label>
          <div className="report-mode"><span className="section-kicker">FORMATO DEL INFORME</span><button className={printMode === 'grilla' ? 'active' : ''} onClick={() => setPrintMode('grilla')}><span><Icon name="calendar" /></span><div><strong>Planilla semanal</strong><small>Matriz de clientes por día</small></div><i>{printMode === 'grilla' ? <Icon name="check" size={14} /> : null}</i></button><button className={printMode === 'detalle' ? 'active' : ''} onClick={() => setPrintMode('detalle')}><span><Icon name="report" /></span><div><strong>Informe detallado</strong><small>Acciones y observaciones</small></div><i>{printMode === 'detalle' ? <Icon name="check" size={14} /> : null}</i></button></div>
          <div className="report-summary"><div><span>Revisiones</span><strong>{reportReviews.length}</strong></div><div><span>Clientes cubiertos</span><strong>{new Set(reportReviews.map(item => item.clientId)).size}</strong></div><div><span>Pendientes</span><strong>{pending.length}</strong></div></div>
          <div className="report-downloads"><button className="primary-button print-button" onClick={() => { const title = document.title; document.title = `${documentTitle} - ${week}`; window.print(); document.title = title }}><Icon name="print" />Imprimir o guardar PDF</button><button className="secondary-button" onClick={downloadPng} disabled={exportingImage}><Icon name="download" />{exportingImage ? 'Preparando imagen…' : 'Descargar PNG'}</button></div>
          <p className="helper-text">El navegador abrirá el diálogo de impresión. Elegí “Guardar como PDF” para generar el archivo.</p>
        </section>

        <NotebookReport store={db} week={week} month={reportPeriod === 'month' ? reportMonth : undefined} mode={printMode} title={documentTitle} preview />
      </div> : null}
    </NotebookPage></AnimatePresence></div>

    <footer className="site-footer screen"><a href="https://ian-pontorno-portfolio.vercel.app" target="_blank" rel="noopener noreferrer">© {new Date().getFullYear()} Ian Pontorno<span>Diseño y desarrollo</span><ExternalLink size={13} aria-hidden="true" /></a><a className="repository-link" href="https://github.com/Ian9Franco/INFORMES_FNG" target="_blank" rel="noopener noreferrer" aria-label="Ver el código de Informes FNG en GitHub"><svg width="19" height="19" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.49c-2.23.48-2.7-.95-2.7-.95-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.33.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82A7.65 7.65 0 0 1 8 3.87c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.07-1.87 3.75-3.65 3.95.29.25.54.74.54 1.49v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" /></svg><span>GitHub</span></a></footer>

    {selected?.mode === 'inline' ? <div ref={saveBarRef} className="rapid-save-bar screen" onKeyDown={reviewShortcut}><div><strong>{client?.name}</strong><small>Borrador local · Ctrl/⌘ + Enter para guardar</small></div><button className="secondary-button" onClick={() => saveReview()} disabled={!client}>Guardar</button><button className="primary-button" onClick={() => saveReview(true)} disabled={!client}>Guardar y siguiente <Icon name="chevron-right" /></button></div> : null}
    {undoReview ? <div className="quick-undo screen" role="status"><span>{clients.find(item => item.id === undoReview.clientId)?.name} · revisado sin cambios</span><button type="button" onClick={undoQuickReview}>Deshacer</button></div> : null}

    {selected?.mode === 'modal' ? <dialog ref={dialogRef} className={`review-modal screen ${closingReview ? 'is-closing' : ''}`} aria-labelledby="review-title" onKeyDown={reviewShortcut} onCancel={event => { event.preventDefault(); closeReview() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeReview() } }}>
        <header><div><span className="section-kicker">REVISIÓN · {format(selected.day)}</span><h2 id="review-title">{client?.name ?? 'Nueva revisión'}</h2><p>Una revisión también cuenta si no hiciste cambios.</p></div><button className="icon-button" onClick={() => closeReview()} aria-label="Cerrar"><Icon name="close" /></button></header>
        <div className="review-modal-body">
        {reviewSignature(current) !== reviewSignature(formBase.current) ? <div className="draft-conflict" role="status">La revisión cambió. Conservamos tu borrador.<button type="button" onClick={reloadReview}>Cargar versión actual</button></div> : null}
        <ClientPicker clients={active} value={selected.id} onChange={id => openReview(id, selected.day)} />
        <QuickActions clientId={selected?.id} catalog={db.customActions} onCreate={createAction} value={actionEntries} onChange={setActionEntries} storageKey={`fng-action-prefs:${userId ?? 'local'}`} />
        <ReviewDetailsFields actions={actions} observations={observations} pendingText={pendingText} onActions={setActions} onObservations={setObservations} onPending={setPendingText} onAddPending={addPending} />
        </div>
        <footer>{current ? <button className="danger-button" onClick={removeReview}><Icon name="trash" />Quitar revisión</button> : null}<div><button className="secondary-button" onClick={() => closeReview()}>Salir</button><button className="primary-button" disabled={!client || closingReview} onClick={() => saveReview()}><Icon name="check" />Guardar revisión</button><button className="secondary-button" disabled={!client || closingReview} onClick={() => saveReview(true)}>Guardar y siguiente</button></div></footer>
    </dialog> : null}

    <NotebookReport store={db} week={week} month={reportPeriod === 'month' ? reportMonth : undefined} mode={printMode} title={documentTitle} />
  </div></MotionConfig>
}
