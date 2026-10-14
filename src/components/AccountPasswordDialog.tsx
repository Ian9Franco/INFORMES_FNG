'use client'

import { useEffect, useRef, useState } from 'react'
import AccountPasswordForm from './AccountPasswordForm'

export default function AccountPasswordDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="auth-card account-password-dialog screen" aria-labelledby="account-password-heading" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="account-password-heading">Contraseña de tu cuenta</h2>
    <p>Este acceso funciona en la PC, el celular y Companion, sin pedir un enlace en cada ingreso.</p>
    <AccountPasswordForm onSaved={() => setSaved(true)} />
    <button className="auth-alternative" type="button" onClick={onClose}>{saved ? 'Listo, continuar' : 'Cerrar'}</button>
  </dialog>
}
