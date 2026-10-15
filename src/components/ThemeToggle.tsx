'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark')
    sync()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      let saved: string | null = null
      try { saved = localStorage.getItem('informe-ian-theme') } catch { /* Private browsing may disable storage. */ }
      if (!saved) {
        document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
        sync()
      }
    }
    media.addEventListener('change', onSystem)
    return () => media.removeEventListener('change', onSystem)
  }, [])

  function toggle() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#f4f0e7' : '#171c1b')
    try { localStorage.setItem('informe-ian-theme', next) } catch { /* Theme still works in memory. */ }
    setDark(!dark)
  }

  return <button type="button" className="theme-toggle" aria-label={dark ? 'Activar tema claro' : 'Activar tema oscuro'} aria-pressed={dark} title={dark ? 'Tema claro' : 'Tema oscuro'} onClick={toggle}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
}
