'use client'

// ChartLine and Check paths/motion adapted from Animate UI (Elliot Sutton).
// https://github.com/imskyleen/animate-ui — license in THIRD_PARTY_NOTICES.md.
import { motion, useReducedMotion } from 'motion/react'

export function AnimatedChart({ active = false }: { active?: boolean }) {
  const calm = useReducedMotion()
  return <motion.svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <motion.path d="m19 9-5 5-4-4-3 3" animate={active && !calm ? { opacity: [0, 1], pathLength: [0, 1], pathOffset: [1, 0] } : { opacity: 1, pathLength: 1, pathOffset: 0 }} transition={{ duration: .65, ease: 'easeInOut' }} />
  </motion.svg>
}

export function AnimatedCheck() {
  const calm = useReducedMotion()
  return <motion.svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><motion.path d="m4 12 5 5L20 6" initial={calm ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: calm ? 0 : .4, ease: 'easeInOut' }} /></motion.svg>
}
