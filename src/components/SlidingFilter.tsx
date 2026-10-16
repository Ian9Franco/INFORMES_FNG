'use client'

import { useId } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'

/** Keep labels and hit areas fixed; only the raised selection travels between them. */
export default function SlidingFilter<T extends string>({ label, value, options, onChange, className = '' }: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  const id = useId()
  const calm = useReducedMotion()
  return <LayoutGroup id={id}>
    <div className={`segmented sliding-filter ${className}`} role="group" aria-label={label}>
      {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => { if (option.value !== value) onChange(option.value) }}>
        {value === option.value ? <motion.span aria-hidden="true" className="filter-highlight" layoutId="selection" initial={false} transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 31, mass: .9 }} /> : null}
        <span className="filter-label">{option.label}</span>
      </button>)}
    </div>
  </LayoutGroup>
}
