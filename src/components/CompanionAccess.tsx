'use client'
import AccountPasswordForm from './AccountPasswordForm'

export default function CompanionAccess() {
  return <section className="companion-access" aria-label="Conectar Companion en la PC"><p>En la extensión ingresá con el mismo correo y contraseña de Informes. Podés definir una contraseña acá si usás enlaces de acceso.</p><AccountPasswordForm /></section>
}
