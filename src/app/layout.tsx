import type { Metadata, Viewport } from 'next'
import '../styles.css'
import '../polish.css'
import '../workspace-ui.css'
import '../notebook.css'
import '../rapid-review.css'
import '../interface-polish.css'
import '../personalization.css'
export const metadata: Metadata = {
  title: 'Informes FNG',
  description: 'Seguimiento de clientes, revisiones, pendientes e informes publicitarios',
  manifest: '/manifest.webmanifest'
}
export const viewport: Viewport = { themeColor: '#f4f0e7', width: 'device-width', initialScale: 1, viewportFit: 'cover' }
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) {
  return <html lang="es" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('informe-ian-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',d?'#171c1b':'#f4f0e7')}catch(e){document.documentElement.dataset.theme='light'}})()` }} /></head><body>{children}</body></html>
}
