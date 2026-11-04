import { date, keyDate } from './data.ts'
import { reportFileName } from './report-export.ts'

export const DEFAULT_REPORT_FOLDER = '\\\\Barton-8000\\fanger\\Users\\IanP\\informes'

export type WeekArchive = { week: string; simple: string; detailed: string; hasSimple: boolean; hasDetailed: boolean }

export type MonthArchive = {
  weeks: WeekArchive[]
  finished: boolean
  complete: boolean
  monthlySimple: string
  monthlyDetailed: string
  hasMonthly: boolean
  deletable: string[]
}

/** Mondays whose week file belongs to the month, matching `semanal YYYY-MM-DD`. */
export function weeksStartingInMonth(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mes inválido')
  const [year, number] = month.split('-').map(Number)
  const cursor = new Date(year, number - 1, 1, 12)
  const end = new Date(year, number, 1, 12)
  const sinceMonday = (cursor.getDay() + 6) % 7
  if (sinceMonday !== 0) cursor.setDate(cursor.getDate() + (7 - sinceMonday))
  const weeks: string[] = []
  while (cursor < end) {
    weeks.push(keyDate(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function monthWeeksFinished(month: string, today: string): boolean {
  const weeks = weeksStartingInMonth(month)
  if (!weeks.length) return false
  const saturday = date(weeks[weeks.length - 1])
  saturday.setDate(saturday.getDate() + 5)
  return keyDate(saturday) < today
}

export function previousMonth(today: string): string {
  const current = date(today.slice(0, 7) + '-01')
  current.setMonth(current.getMonth() - 1)
  return keyDate(current).slice(0, 7)
}

function pdfName(title: string, period: 'week' | 'month', id: string, mode: 'grilla' | 'detalle') {
  return `${reportFileName(title, period, id, mode)}.pdf`
}

export function monthArchive(title: string, month: string, today: string, fileNames: readonly string[]): MonthArchive {
  const present = new Set(fileNames)
  const weeks = weeksStartingInMonth(month).map(week => {
    const simple = pdfName(title, 'week', week, 'grilla')
    const detailed = pdfName(title, 'week', week, 'detalle')
    return { week, simple, detailed, hasSimple: present.has(simple), hasDetailed: present.has(detailed) }
  })
  const monthlySimple = pdfName(title, 'month', month, 'grilla')
  const monthlyDetailed = pdfName(title, 'month', month, 'detalle')
  const finished = monthWeeksFinished(month, today)
  const complete = finished && weeks.length > 0 && weeks.every(week => week.hasSimple && week.hasDetailed)
  return {
    weeks,
    finished,
    complete,
    monthlySimple,
    monthlyDetailed,
    hasMonthly: present.has(monthlySimple) && present.has(monthlyDetailed),
    deletable: weeks.flatMap(week => [week.hasSimple ? week.simple : '', week.hasDetailed ? week.detailed : ''].filter(Boolean)),
  }
}
