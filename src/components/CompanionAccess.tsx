'use client'
import AccountPasswordForm from './AccountPasswordForm'

export default function CompanionAccess() {
  return <details className="panel companion-access"><summary>Conectar Companion en la PC</summary><p>En la extensión ingresá con el mismo correo y contraseña de Informes. Si entrás por enlace, podés definir una contraseña aquí o desde «Contraseña de mi cuenta» en la barra superior.</p><AccountPasswordForm /></details>
}
