'use client'
import { motion, useIsPresent, usePresenceData, useReducedMotion } from 'motion/react'

export default function NotebookPage({ name, side, onEntered, children }: { name: string; side: number; onEntered: () => void; children: React.ReactNode }) {
  const present = useIsPresent()
  const presenceSide = usePresenceData()
  const direction = typeof presenceSide === 'number' ? presenceSide : side
  const calm = useReducedMotion()
  return <motion.main className="workspace notebook-page" data-page={name} inert={!present} aria-hidden={!present} custom={direction} variants={{
    enter: (side: number) => ({ opacity: 0, x: calm ? 0 : side * 28 }),
    present: { opacity: 1, x: 0, transition: { duration: calm ? 0 : .34, ease: [.2, .8, .2, 1] } },
    leave: (side: number) => ({ opacity: 0, x: calm ? 0 : side * -24, transition: { duration: calm ? 0 : .18, ease: [.4, 0, 1, 1] } }),
  }} initial="enter" animate="present" exit="leave" onAnimationComplete={definition => { if (definition === 'present') onEntered() }}>{children}</motion.main>
}
