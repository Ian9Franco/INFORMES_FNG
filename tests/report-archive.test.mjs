import test from 'node:test'
import assert from 'node:assert/strict'
import { monthArchive, monthWeeksFinished, previousMonth, weeksStartingInMonth } from '../src/report-archive.ts'

test('a month keeps the weekly files named by each Monday and finishes on its last Saturday', () => {
  assert.deepEqual(weeksStartingInMonth('2026-10'), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
  assert.equal(monthWeeksFinished('2026-10', '2026-11-04'), true)
  assert.equal(monthWeeksFinished('2026-11', '2026-11-04'), false)
  assert.equal(previousMonth('2026-11-04'), '2026-10')
})

test('the monthly pair is allowed only when every week of a finished month has both files', () => {
  const title = 'Informe Ian'
  const names = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].flatMap(week => [`${title} - semanal ${week} - simple.pdf`, `${title} - semanal ${week} - detallado.pdf`])
  const missing = monthArchive(title, '2026-10', '2026-11-04', names.slice(2))
  assert.equal(missing.complete, false)
  assert.equal(missing.weeks[0].hasSimple, false)
  const ready = monthArchive(title, '2026-10', '2026-11-04', names)
  assert.equal(ready.complete, true)
  assert.equal(ready.hasMonthly, false)
  assert.deepEqual(ready.deletable, names)
  const stored = monthArchive(title, '2026-10', '2026-11-04', [...names, ready.monthlySimple, ready.monthlyDetailed])
  assert.equal(stored.hasMonthly, true)
  assert.equal(stored.deletable.includes(stored.monthlySimple), false)
  assert.equal(monthArchive(title, '2026-11', '2026-11-04', []).complete, false)
})
