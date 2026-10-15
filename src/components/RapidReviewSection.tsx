'use client'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { useState } from 'react'

const contentReveal = { opacity: [0, 1, 1], y: [8, -1, 0], scaleX: [.985, 1.008, 1], scaleY: [.975, 1.006, 1] }
const contentRest = { opacity: 1, y: 0, scaleX: 1, scaleY: 1 }

export default function RapidReviewSection({ id, label, onKeyDown, children }: { id: string; label: string; onKeyDown: (event: React.KeyboardEvent) => void; children: React.ReactNode }) {
  const present = useIsPresent()
  const calm = useReducedMotion()
  const [settled, setSettled] = useState(Boolean(calm))
  return <motion.section id={id} className="rapid-review" aria-label={label} inert={!present} aria-hidden={!present} data-presence={present ? 'open' : 'closing'} onKeyDown={onKeyDown} style={{ overflow: present && settled ? 'visible' : 'hidden' }} onAnimationStart={() => setSettled(false)} onAnimationComplete={() => { if (present) setSettled(true) }} initial={calm ? false : { height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0, transition: { duration: calm ? 0 : .34, delay: calm ? 0 : .06, ease: [.4, 0, .25, 1] } }} transition={{ duration: calm ? 0 : .46, ease: [.2, .72, .2, 1] }}>
    <motion.div className="rapid-review-content" initial={calm ? false : { opacity: 0, y: 8, scaleX: .985, scaleY: .975 }} animate={calm ? contentRest : contentReveal} exit={{ opacity: 0, y: calm ? 0 : -4, scaleX: calm ? 1 : 1.008, scaleY: calm ? 1 : .98, transition: { duration: calm ? 0 : .18 } }} transition={{ duration: calm ? 0 : .46, times: [0, .7, 1], ease: [.2, .72, .2, 1] }}>{children}</motion.div>
  </motion.section>
}
