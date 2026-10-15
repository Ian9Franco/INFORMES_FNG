'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

type Request = { title: string; message: string; accept?: string; danger?: boolean }
export default function useConfirmation() {
  const [request, setRequest] = useState<Request | null>(null)
  const resolve = useRef<((value: boolean) => void) | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => { if (request && !dialog.current?.open) dialog.current?.showModal() }, [request])
  useEffect(() => () => { resolve.current?.(false); resolve.current = null }, [])
  function finish(value: boolean) { dialog.current?.close(); resolve.current?.(value); resolve.current = null; setRequest(null) }
  function confirm(next: Request) {
    resolve.current?.(false)
    setRequest(next)
    return new Promise<boolean>(done => { resolve.current = done })
  }
  const confirmation = request ? <dialog ref={dialog} className="confirmation-dialog screen" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); finish(false) }}>
    <span className={`confirmation-symbol ${request.danger ? 'is-danger' : ''}`}><AlertTriangle size={24} aria-hidden="true" /></span>
    <h2 id={`${id}-title`}>{request.title}</h2><p id={`${id}-body`}>{request.message}</p>
    <footer><button type="button" className="secondary-button" autoFocus onClick={() => finish(false)}>Cancelar</button><button type="button" className={request.danger ? 'danger-button' : 'primary-button'} onClick={() => finish(true)}>{request.accept ?? 'Continuar'}</button></footer>
  </dialog> : null
  return { confirm, confirmation }
}
