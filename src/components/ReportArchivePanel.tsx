'use client'

import { useEffect, useState } from 'react'
import { format } from '../data'
import { DEFAULT_REPORT_FOLDER, monthArchive, previousMonth } from '../report-archive'
import { reportFileName } from '../report-export'
import { FOLDER_CONNECTED_KEY, FOLDER_PATH_KEY, deleteFolderFiles, folderPermission, folderPickerAvailable, listFolderFiles, loadFolderHandle, pickReportFolder, writeFolderFile } from '../report-folder'

type Confirm = (request: { title: string; message: string; accept?: string; danger?: boolean }) => Promise<boolean>
type BuildPdf = (period: 'week' | 'month', id: string, mode: 'grilla' | 'detalle') => Promise<Uint8Array>

const readPath = () => { try { return localStorage.getItem(FOLDER_PATH_KEY) || DEFAULT_REPORT_FOLDER } catch { return DEFAULT_REPORT_FOLDER } }
const readConnected = () => { try { return localStorage.getItem(FOLDER_CONNECTED_KEY) || '' } catch { return '' } }

export default function ReportArchivePanel({ title, today, week, confirm, buildPdf }: { title: string; today: string; week: string; confirm: Confirm; buildPdf: BuildPdf }) {
  const [path, setPath] = useState(readPath)
  const [connectedPath, setConnectedPath] = useState(readConnected)
  const [files, setFiles] = useState<string[] | null>(null)
  const [month, setMonth] = useState(() => previousMonth(today))
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const connected = Boolean(connectedPath) && connectedPath === path
  const status = monthArchive(title, month, today, files ?? [])
  const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`))

  useEffect(() => { try { localStorage.setItem(FOLDER_PATH_KEY, path) } catch { /* The field still works for this visit. */ } }, [path])

  async function refresh(handle = loadFolderHandle()) {
    const folder = await handle
    if (!folder || !(await folderPermission(folder, false))) { setFiles(null); return }
    setFiles(await listFolderFiles(folder))
  }

  useEffect(() => { if (connected) void refresh().catch(() => setFiles(null)) }, [connected])

  async function connect() {
    setError(''); setNotice('')
    try {
      await pickReportFolder()
      localStorage.setItem(FOLDER_CONNECTED_KEY, path)
      setConnectedPath(path)
      await refresh()
      setNotice('Carpeta conectada. Los PDF se guardan ahí.')
    } catch (cause) { if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message) }
  }

  async function grantedFolder() {
    const folder = await loadFolderHandle()
    if (!folder || !(await folderPermission(folder, true))) throw new Error('Volvé a conectar la carpeta para poder guardar.')
    return folder
  }

  async function savePair(period: 'week' | 'month', id: string, simpleName: string, detailedName: string) {
    const folder = await grantedFolder()
    await writeFolderFile(folder, simpleName, await buildPdf(period, id, 'grilla'))
    await writeFolderFile(folder, detailedName, await buildPdf(period, id, 'detalle'))
    await refresh(Promise.resolve(folder))
  }

  async function saveWeek() {
    setBusy('semana'); setError(''); setNotice('')
    try {
      await savePair('week', week, `${reportFileName(title, 'week', week, 'grilla')}.pdf`, `${reportFileName(title, 'week', week, 'detalle')}.pdf`)
      setNotice('Semana guardada: simple y detallado.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la semana.') }
    finally { setBusy('') }
  }

  async function saveMonth() {
    setBusy('mes'); setError(''); setNotice('')
    try {
      await savePair('month', month, status.monthlySimple, status.monthlyDetailed)
      setNotice(`Resumen de ${monthName} guardado. Ya podés borrar las semanas.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el resumen.') }
    finally { setBusy('') }
  }

  async function removeWeeks() {
    if (!await confirm({ title: `¿Borrar las semanas de ${monthName}?`, message: 'Se borran solo los PDF semanales de ese mes. Quedan el simple y el detallado del mes.', accept: 'Borrar semanas', danger: true })) return
    setBusy('borrar'); setError(''); setNotice('')
    try {
      const folder = await grantedFolder()
      await deleteFolderFiles(folder, status.deletable)
      await refresh(Promise.resolve(folder))
      setNotice('Quedaron solo los dos informes del mes.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron borrar las semanas.') }
    finally { setBusy('') }
  }

  const reason = !connected ? 'Conectá la carpeta para guardar ahí.' : !status.finished ? 'Este mes todavía no terminó.' : !status.complete ? 'Falta guardar el simple y el detallado de cada semana del mes.' : ''

  return <section className="report-archive" aria-label="Carpeta de informes">
    <div><span className="section-kicker">CARPETA</span><h2>Dónde quedan guardados</h2></div>
    <label className="report-title-label">Ruta<input className="report-title-input" value={path} onChange={event => setPath(event.target.value)} aria-label="Ruta de la carpeta de informes" spellCheck={false} /></label>
    <p className="helper-text">La ruta de ahora es {DEFAULT_REPORT_FOLDER}. La primera vez hay que elegir esa carpeta en el diálogo: el navegador no puede abrirla solo.</p>
    <div className="report-archive-actions">
      <button type="button" className="secondary-button" onClick={() => void connect()} disabled={!folderPickerAvailable() || Boolean(busy)}>{connected ? 'Volver a conectar' : 'Conectar carpeta'}</button>
      <button type="button" className="secondary-button" onClick={() => void saveWeek()} disabled={!connected || Boolean(busy)}>{busy === 'semana' ? 'Guardando semana…' : 'Guardar esta semana en la carpeta'}</button>
    </div>
    {!folderPickerAvailable() ? <p className="helper-text">Este navegador no puede escribir en la carpeta. Usá Chrome.</p> : null}
    <div className="report-archive-month"><span className="section-kicker">RESUMEN MENSUAL</span><label className="report-title-label">Mes<input type="month" className="report-title-input" value={month} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value) }} /></label></div>
    <ul className="report-archive-weeks">{status.weeks.map(item => <li key={item.week}><span>Semana del {format(item.week)}</span><b className={item.hasSimple && item.hasDetailed ? 'is-ready' : ''}>{item.hasSimple && item.hasDetailed ? 'Simple y detallado' : !item.hasSimple && !item.hasDetailed ? 'Sin guardar' : item.hasSimple ? 'Falta el detallado' : 'Falta el simple'}</b></li>)}</ul>
    <div className="report-archive-actions">
      <button type="button" className="primary-button" disabled={!connected || !status.complete || Boolean(busy)} onClick={() => void saveMonth()}>{busy === 'mes' ? 'Creando resumen…' : `Crear resumen de ${monthName}`}</button>
      <button type="button" className="secondary-button" disabled={!connected || !status.hasMonthly || !status.deletable.length || Boolean(busy)} onClick={() => void removeWeeks()}>{busy === 'borrar' ? 'Borrando…' : 'Borrar semanas de este mes'}</button>
    </div>
    {reason && connected ? <p className="helper-text">{reason}</p> : null}
    {notice ? <p className="helper-text" role="status">{notice}</p> : null}
    {error ? <p className="helper-text" role="alert">{error}</p> : null}
  </section>
}
