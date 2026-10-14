import type { Metadata, Viewport } from 'next'
import '../styles.css'
export const metadata: Metadata = {
  title: 'Informes FNG',
  description: 'Seguimiento de clientes, revisiones, pendientes e informes publicitarios',
  manifest: '/manifest.webmanifest'
}
export const viewport: Viewport = { themeColor: '#172c2a', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>
}
