'use client'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import type { ComponentProps, ReactNode } from 'react'
import NotebookReport from './NotebookReport'

const reveal = { opacity: [0, 1, 1], y: [10, -1, 0], scaleX: [.98, 1.008, 1], scaleY: [.96, .996, 1] }
const rest = { opacity: 1, y: 0, scaleX: 1, scaleY: 1 }
function PreviewPage({ children }: { children: ReactNode }) {
  const calm = useReducedMotion()
  const present = useIsPresent()
  return <motion.div className="report-preview-page" inert={!present} aria-hidden={!present} data-presence={present ? 'open' : 'closing'} initial={calm ? false : { opacity: 0, y: 10, scaleX: .98, scaleY: .96 }} animate={calm ? rest : reveal} exit={{ opacity: 0, y: calm ? 0 : -6, scaleX: calm ? 1 : 1.01, scaleY: calm ? 1 : .975, transition: { duration: calm ? 0 : .18 } }} transition={{ duration: calm ? 0 : .46, times: [0, .7, 1], ease: [.2, .72, .2, 1] }}>{children}</motion.div>
}

export default function ReportPreview(props: ComponentProps<typeof NotebookReport>) {
  return <div className="report-preview-transition"><AnimatePresence mode="wait" initial={false}><PreviewPage key={props.mode}><NotebookReport {...props} preview /></PreviewPage></AnimatePresence></div>
}
