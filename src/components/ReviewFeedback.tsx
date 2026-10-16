'use client'
import { AnimatePresence, motion, useAnimationControls, useIsPresent, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { AnimatedCheck } from './AnimatedSymbols'

const liquidReveal = { scaleX: [1.09, .96, 1.015, 1], scaleY: [.86, 1.06, .985, 1] }
const liquidRest = { scaleX: 1, scaleY: 1 }
const barReveal = { opacity: [0, 1, 1], y: [14, -2, 0], scaleX: [.975, 1.008, 1], scaleY: [.92, 1.025, 1] }
const barRest = { opacity: 1, y: 0, scaleX: 1, scaleY: 1 }

export function NavigationIndicator() {
  const calm = useReducedMotion()
  return <motion.span className="navigation-highlight" layoutId="active-navigation" transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 25, mass: .75 }}><motion.span className="navigation-liquid-core" initial={calm ? false : { scaleX: 1.09, scaleY: .86 }} animate={calm ? liquidRest : liquidReveal} transition={{ duration: calm ? 0 : .48, times: [0, .5, .78, 1], ease: 'easeInOut' }} /></motion.span>
}

/** Animate changes, not the initial load of every client in the list. */
export function ReviewState({ reviewed, issue = false }: { reviewed: boolean; issue?: boolean }) {
  const calm = useReducedMotion()
  const controls = useAnimationControls()
  const previous = useRef(reviewed)
  useEffect(() => {
    if (previous.current === reviewed) return
    previous.current = reviewed
    controls.stop()
    if (calm) { controls.set({ scaleX: 1, scaleY: 1 }); return }
    void controls.start({ scaleX: [1, 1.18, .95, 1.035, 1], scaleY: [1, .86, 1.12, .975, 1], transition: { duration: .58, times: [0, .25, .5, .75, 1], ease: 'easeInOut' } })
  }, [reviewed, calm, controls])
  return <motion.span className={`review-state ${reviewed ? 'done' : ''} ${issue ? 'has-issue' : ''}`} data-confirmed={reviewed} aria-hidden="true" initial={false} animate={controls}>
    <AnimatePresence initial={false} mode="wait"><motion.span className="review-state-symbol" key={issue ? 'issue' : reviewed ? 'done' : 'pending'} initial={calm ? false : { opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: calm ? 1 : .65 }} transition={{ duration: calm ? 0 : .16 }}>{issue ? <b>!</b> : reviewed ? <AnimatedCheck /> : <span className="review-state-dot" />}</motion.span></AnimatePresence>
  </motion.span>
}

export function ReviewStateLabel({ label, reviewed, issue = false }: { label: string; reviewed: boolean; issue?: boolean }) {
  const calm = useReducedMotion()
  return <span className={`state-pill review-state-label ${reviewed ? 'done' : ''} ${issue ? 'has-issue' : ''}`}><AnimatePresence mode="wait" initial={false}><motion.span key={label} initial={calm ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: calm ? 0 : -3 }} transition={{ duration: calm ? 0 : .14 }}>{label}</motion.span></AnimatePresence></span>
}

export function RapidSaveBar({ barRef, onKeyDown, children }: { barRef: React.Ref<HTMLDivElement>; onKeyDown: (event: React.KeyboardEvent) => void; children: React.ReactNode }) {
  const calm = useReducedMotion()
  const present = useIsPresent()
  return <motion.div ref={barRef} className="rapid-save-bar screen" inert={!present} aria-hidden={!present} data-presence={present ? 'open' : 'closing'} onKeyDown={onKeyDown} initial={calm ? false : { opacity: 0, y: 14, scaleX: .975, scaleY: .92 }} animate={calm ? barRest : barReveal} exit={{ opacity: 0, y: calm ? 0 : 10, scaleX: calm ? 1 : 1.015, scaleY: calm ? 1 : .94, transition: { duration: calm ? 0 : .24 } }} transition={{ duration: calm ? 0 : .46, times: [0, .72, 1], ease: [.2, .72, .2, 1] }}>{children}</motion.div>
}
