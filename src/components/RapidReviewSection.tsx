'use client'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'

export default function RapidReviewSection({ id, label, onKeyDown, children }: { id: string; label: string; onKeyDown: (event: React.KeyboardEvent) => void; children: React.ReactNode }) {
  const present = useIsPresent()
  const calm = useReducedMotion()
  return <motion.section id={id} className="rapid-review" aria-label={label} inert={!present} aria-hidden={!present} onKeyDown={onKeyDown} initial={calm ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: calm ? 0 : .2, ease: [.22, 1, .36, 1] }}>{children}</motion.section>
}
