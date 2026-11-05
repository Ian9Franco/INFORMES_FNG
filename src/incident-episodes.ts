import { date, keyDate, monday, weekDays } from './data.ts'
import type { Review } from './data.ts'
import { ISSUE_TYPES, validReviewIssues, type ReviewIssue } from './review-issues.ts'
import { WORK_SERVICES, reviewService, type WorkService } from './work-services.ts'

/**
 * Longitudinal reading of the issues already stored on reviews.
 * This module only derives episodes. It does not write reviews, conditions,
 * pending tasks, or campaign changes.
 *
 * A condition class is the kind of situation. An episode is one continuous
 * occurrence of that class for a stable identity. Observations are the
 * dated evidence attached to that episode. Repeating the same identity
 * updates the episode; it does not open another one.
 */

export const CONDITION_CLASSES = ['technical_or_policy', 'no_budget', 'voluntary_pause', 'pending_material', 'performance_anomaly'] as const
export type ConditionClass = typeof CONDITION_CLASSES[number]
export const EPISODE_STATUSES = ['detectada', 'investigando', 'escalada_o_depende_de_terceros', 'resuelta'] as const
export type EpisodeStatus = typeof EPISODE_STATUSES[number]
export const OPEN_EPISODE_STATUSES = ['detectada', 'investigando', 'escalada_o_depende_de_terceros'] as const
export type OpenEpisodeStatus = typeof OPEN_EPISODE_STATUSES[number]
export const INCIDENT_ORIGINS = ['manual', 'csv', 'api'] as const
export type IncidentOrigin = typeof INCIDENT_ORIGINS[number]

/** Lower rank is more urgent. A voluntary pause is ordered last and is never a failure. */
export const IMPACT_RANK: Record<ConditionClass, number> = {
  technical_or_policy: 0,
  no_budget: 1,
  pending_material: 2,
  performance_anomaly: 3,
  voluntary_pause: 4,
}

const CLASS_BY_ISSUE: Record<ReviewIssue['type'], ConditionClass> = {
  error: 'technical_or_policy',
  no_budget: 'no_budget',
  client_paused: 'voluntary_pause',
}
const REVIEW_CLASSES: readonly ConditionClass[] = ['technical_or_policy', 'no_budget', 'voluntary_pause']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const CLASS_SET = new Set<string>(CONDITION_CLASSES)
const SERVICE_SET = new Set<string>(WORK_SERVICES)
const ORIGIN_SET = new Set<string>(INCIDENT_ORIGINS)
const OPEN_STATUS_SET = new Set<string>(OPEN_EPISODE_STATUSES)

export type IncidentIdentity = {
  clientId: string
  service: WorkService
  accountId?: string
  conditionClass: ConditionClass
  externalId?: string
}

export type IncidentSignal = IncidentIdentity & {
  date: string
  recordedAt?: string
  reviewId?: string
  detail?: string
  note?: string
  origin: IncidentOrigin
  /** present: observed. cleared: an explicit manual list omitted it. insufficient: the source cannot prove either. */
  signal: 'present' | 'cleared' | 'insufficient'
}

export type IncidentObservation = {
  date: string
  reviewId?: string
  detail?: string
  note?: string
  origin: IncidentOrigin
  signal: IncidentObservationSignal
}
type IncidentObservationSignal = IncidentSignal['signal']

export type StatusMark = { status: OpenEpisodeStatus; note?: string; at: string }

export type IncidentEpisode = IncidentIdentity & {
  id: string
  generation: number
  countsAsFailure: boolean
  impact: number
  status: EpisodeStatus
  origin: IncidentOrigin
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt?: string
  resolution?: 'manual'
  latestDetail?: string
  observations: IncidentObservation[]
  previousEpisodeId?: string
  statusHistory: StatusMark[]
}

export type WorkflowAnnotation = IncidentIdentity & {
  generation?: number
  status: OpenEpisodeStatus
  note?: string
  at: string
}

export type IncidentPeriod = { start: string; end: string }
export type IncidentBucket = { nuevas: IncidentEpisode[]; persistentes: IncidentEpisode[]; resueltas: IncidentEpisode[]; abiertas: IncidentEpisode[] }
export type IncidentSummary = {
  asOf: string
  period?: IncidentPeriod
  /** Inclusive length of the requested period. A shorter count is not an equivalent week. */
  periodDayCount?: number
  failures: IncidentBucket
  informational: IncidentBucket
}

const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value)
export const countsAsFailure = (conditionClass: ConditionClass) => conditionClass !== 'voluntary_pause'
export const incidentIdentityKey = (identity: IncidentIdentity) => [identity.clientId, identity.service, identity.accountId ?? '', identity.conditionClass, identity.externalId ?? ''].join('\u001f')

/** Absent text is undefined. A wrong type or an over-long value is null so the whole signal is rejected. */
function readBounded(value: unknown, max: number): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length > max) return null
  const text = value.trim()
  if (!text || text.length > max) return null
  return text
}

function readIdentity(value: object): IncidentIdentity | undefined {
  const source = value as Partial<IncidentIdentity>
  const clientId = readBounded(source.clientId, 160)
  const accountId = readBounded(source.accountId, 64)
  const externalId = readBounded(source.externalId, 160)
  if (!clientId || accountId === null || externalId === null) return undefined
  if (!SERVICE_SET.has(source.service ?? '') || !CLASS_SET.has(source.conditionClass ?? '')) return undefined
  const service = source.service as WorkService
  const conditionClass = source.conditionClass as ConditionClass
  if (conditionClass === 'voluntary_pause' && service === 'meta_organic') return undefined
  return { clientId, service, conditionClass, ...(accountId ? { accountId } : {}), ...(externalId ? { externalId } : {}) }
}

export function normalizeIncidentSignal(value: unknown): IncidentSignal | undefined {
  if (!value || typeof value !== 'object') return undefined
  const identity = readIdentity(value)
  const source = value as Partial<IncidentSignal>
  if (!identity || !isDay(source.date) || !ORIGIN_SET.has(source.origin ?? '')) return undefined
  if (source.signal !== 'present' && source.signal !== 'cleared' && source.signal !== 'insufficient') return undefined
  const detail = readBounded(source.detail, 600)
  const note = readBounded(source.note, 600)
  const reviewId = readBounded(source.reviewId, 160)
  if (detail === null || note === null || reviewId === null) return undefined
  const recordedAt = source.recordedAt === undefined ? undefined : readBounded(source.recordedAt, 80)
  if (recordedAt === null) return undefined
  return {
    ...identity,
    date: source.date,
    origin: source.origin as IncidentOrigin,
    signal: source.signal,
    ...(recordedAt ? { recordedAt } : {}),
    ...(reviewId ? { reviewId } : {}),
    ...(detail ? { detail } : {}),
    ...(note ? { note } : {}),
  }
}

function keptDetail(detail: string | undefined) {
  if (typeof detail !== 'string' || !detail.trim() || detail.length > 600) return undefined
  return detail
}

/** Reviews are evidence. Free-text actions and observations are never classified. An omitted `issues` key is not a resolution. */
export function signalsFromReviews(reviews: readonly Review[]): IncidentSignal[] {
  const signals: IncidentSignal[] = []
  for (const review of reviews) {
    if (!review?.clientId || !isDay(review.date) || !validReviewIssues(review.issues)) continue
    const service = reviewService(review)
    const present = new Set<ConditionClass>()
    for (const issue of review.issues) {
      const conditionClass = CLASS_BY_ISSUE[issue.type]
      if (conditionClass === 'voluntary_pause' && service === 'meta_organic') continue
      present.add(conditionClass)
      const detail = keptDetail(issue.detail)
      signals.push({
        clientId: review.clientId,
        service,
        conditionClass,
        date: review.date,
        ...(review.createdAt && review.createdAt.length <= 80 ? { recordedAt: review.createdAt } : {}),
        reviewId: review.id,
        ...(detail ? { detail } : {}),
        origin: 'manual',
        signal: 'present',
      })
    }
    for (const conditionClass of REVIEW_CLASSES) {
      if (present.has(conditionClass) || (conditionClass === 'voluntary_pause' && service === 'meta_organic')) continue
      signals.push({
        clientId: review.clientId,
        service,
        conditionClass,
        date: review.date,
        ...(review.createdAt && review.createdAt.length <= 80 ? { recordedAt: review.createdAt } : {}),
        reviewId: review.id,
        origin: 'manual',
        signal: 'cleared',
      })
    }
  }
  return signals
}

const signalRank = (signal: IncidentSignal['signal']) => signal === 'present' ? 0 : signal === 'cleared' ? 1 : 2
const compareSignals = (a: IncidentSignal, b: IncidentSignal) => a.date.localeCompare(b.date) || (a.recordedAt ?? '').localeCompare(b.recordedAt ?? '') || (a.reviewId ?? '').localeCompare(b.reviewId ?? '') || signalRank(a.signal) - signalRank(b.signal)

function dedupeSignals(signals: readonly IncidentSignal[]) {
  const sorted = signals.map(signal => normalizeIncidentSignal(signal)).filter((signal): signal is IncidentSignal => Boolean(signal)).sort(compareSignals)
  const indexByKey = new Map<string, number>()
  const kept: IncidentSignal[] = []
  for (const signal of sorted) {
    const identity = incidentIdentityKey(signal)
    const repeat = signal.reviewId ? `${identity}\u001f${signal.reviewId}\u001f${signal.signal}` : `${identity}\u001f${signal.date}\u001f${signal.origin}\u001f${signal.signal}`
    const existing = indexByKey.get(repeat)
    if (existing === undefined) {
      indexByKey.set(repeat, kept.length)
      kept.push(signal)
    } else kept[existing] = signal
  }
  return kept.sort(compareSignals)
}

function observation(signal: IncidentSignal, kind: IncidentObservationSignal): IncidentObservation {
  return {
    date: signal.date,
    ...(signal.reviewId ? { reviewId: signal.reviewId } : {}),
    ...(signal.detail ? { detail: signal.detail } : {}),
    ...(signal.note ? { note: signal.note } : {}),
    origin: signal.origin,
    signal: kind,
  }
}

function episodeId(signal: IncidentSignal, generation: number) {
  return ['ep', signal.clientId, signal.service, signal.accountId ?? '-', signal.conditionClass, signal.externalId ?? '-', String(generation)].join(':')
}

function foldIdentity(signals: readonly IncidentSignal[]): IncidentEpisode[] {
  const episodes: IncidentEpisode[] = []
  let open: IncidentEpisode | undefined
  let generation = 0
  for (const signal of signals) {
    const manualClear = signal.signal === 'cleared' && signal.origin === 'manual'
    if (signal.signal !== 'present' && !manualClear) {
      if (open) open.observations.push(observation(signal, 'insufficient'))
      continue
    }
    if (manualClear) {
      if (!open) continue
      open.observations.push(observation(signal, 'cleared'))
      open.resolvedAt = signal.date
      open.resolution = 'manual'
      open.status = 'resuelta'
      episodes.push(open)
      open = undefined
      continue
    }
    if (!open) {
      generation += 1
      open = {
        id: episodeId(signal, generation),
        generation,
        clientId: signal.clientId,
        service: signal.service,
        ...(signal.accountId ? { accountId: signal.accountId } : {}),
        conditionClass: signal.conditionClass,
        ...(signal.externalId ? { externalId: signal.externalId } : {}),
        countsAsFailure: countsAsFailure(signal.conditionClass),
        impact: IMPACT_RANK[signal.conditionClass],
        status: 'detectada',
        origin: signal.origin,
        firstSeenAt: signal.date,
        lastSeenAt: signal.date,
        ...(signal.detail ? { latestDetail: signal.detail } : {}),
        observations: [observation(signal, 'present')],
        ...(episodes.at(-1) ? { previousEpisodeId: episodes.at(-1)!.id } : {}),
        statusHistory: [],
      }
      continue
    }
    open.lastSeenAt = signal.date
    if (signal.detail) open.latestDetail = signal.detail
    else delete open.latestDetail
    open.observations.push(observation(signal, 'present'))
  }
  if (open) episodes.push(open)
  return episodes
}

function applyAnnotations(episodes: IncidentEpisode[], annotations: readonly WorkflowAnnotation[]) {
  for (const raw of annotations) {
    if (!raw || typeof raw !== 'object' || !OPEN_STATUS_SET.has(raw.status) || typeof raw.at !== 'string' || !isDay(raw.at.slice(0, 10))) continue
    const identity = readIdentity(raw)
    const note = readBounded(raw.note, 600)
    if (!identity || note === null || (raw.generation !== undefined && (!Number.isInteger(raw.generation) || raw.generation < 1))) continue
    const day = raw.at.slice(0, 10)
    const matches = episodes.filter(episode => incidentIdentityKey(episode) === incidentIdentityKey(identity) && (raw.generation === undefined || episode.generation === raw.generation) && episode.firstSeenAt <= day && (!episode.resolvedAt || day <= episode.resolvedAt))
    const target = matches.sort((a, b) => a.generation - b.generation).at(-1)
    if (!target) continue
    target.statusHistory.push({ status: raw.status, at: raw.at, ...(note ? { note } : {}) })
  }
  for (const episode of episodes) {
    episode.statusHistory.sort((a, b) => a.at.localeCompare(b.at))
    if (episode.resolvedAt) episode.status = 'resuelta'
    else episode.status = episode.statusHistory.at(-1)?.status ?? 'detectada'
  }
}

export function deriveIncidentEpisodes(signals: readonly IncidentSignal[], annotations: readonly WorkflowAnnotation[] = []): IncidentEpisode[] {
  const groups = new Map<string, IncidentSignal[]>()
  for (const signal of dedupeSignals(signals)) {
    const key = incidentIdentityKey(signal)
    const group = groups.get(key)
    if (group) group.push(signal)
    else groups.set(key, [signal])
  }
  const episodes = [...groups.values()].flatMap(foldIdentity)
  applyAnnotations(episodes, annotations)
  episodes.sort((a, b) => a.clientId.localeCompare(b.clientId) || a.service.localeCompare(b.service) || a.conditionClass.localeCompare(b.conditionClass) || (a.accountId ?? '').localeCompare(b.accountId ?? '') || (a.externalId ?? '').localeCompare(b.externalId ?? '') || a.generation - b.generation)
  return episodes
}

export const episodesFromReviews = (reviews: readonly Review[], annotations: readonly WorkflowAnnotation[] = []) => deriveIncidentEpisodes(signalsFromReviews(reviews), annotations)

/** Point-in-time view. A later resolution does not change what was open on an earlier day. */
export function episodeAt(episode: IncidentEpisode, asOf: string): IncidentEpisode | undefined {
  if (!isDay(asOf) || episode.firstSeenAt > asOf) return undefined
  const observations = episode.observations.filter(item => item.date <= asOf)
  const lastPresent = observations.filter(item => item.signal === 'present').at(-1)
  const resolved = Boolean(episode.resolvedAt && episode.resolvedAt <= asOf)
  const statusHistory = episode.statusHistory.filter(item => item.at.slice(0, 10) <= asOf)
  const viewed: IncidentEpisode = {
    ...episode,
    observations,
    statusHistory,
    lastSeenAt: lastPresent?.date ?? episode.firstSeenAt,
    status: resolved ? 'resuelta' : statusHistory.at(-1)?.status ?? 'detectada',
  }
  if (lastPresent?.detail) viewed.latestDetail = lastPresent.detail
  else delete viewed.latestDetail
  if (resolved) {
    viewed.resolvedAt = episode.resolvedAt
    viewed.resolution = 'manual'
  } else {
    delete viewed.resolvedAt
    delete viewed.resolution
  }
  return viewed
}

function emptyBucket(): IncidentBucket {
  return { nuevas: [], persistentes: [], resueltas: [], abiertas: [] }
}

const byImpact = (a: IncidentEpisode, b: IncidentEpisode) => a.impact - b.impact || a.firstSeenAt.localeCompare(b.firstSeenAt) || a.id.localeCompare(b.id)

export function inclusiveDayCount(period: IncidentPeriod): number | undefined {
  if (!isDay(period.start) || !isDay(period.end) || period.end < period.start) return undefined
  return Math.round((date(period.end).getTime() - date(period.start).getTime()) / 86_400_000) + 1
}

/** Monday–Saturday window used by the weekly sheet. Any day inside the week selects that same window. */
export function operationalWeek(day: string): IncidentPeriod | undefined {
  if (!isDay(day)) return undefined
  const days = weekDays(monday(date(day)))
  return { start: days[0], end: days[days.length - 1] }
}

export function previousOperationalWeek(day: string): IncidentPeriod | undefined {
  const current = operationalWeek(day)
  if (!current) return undefined
  const start = date(current.start)
  start.setDate(start.getDate() - 7)
  return operationalWeek(keyDate(start))
}

/** True only when both ranges are complete Monday–Saturday operational weeks. A partial slice is not equivalent. */
export function equivalentOperationalWeeks(left: IncidentPeriod, right: IncidentPeriod): boolean {
  const a = operationalWeek(left.start)
  const b = operationalWeek(right.start)
  return Boolean(a && b && a.start === left.start && a.end === left.end && b.start === right.start && b.end === right.end)
}

/**
 * With a period, buckets describe that window clipped by `asOf` (a Friday resolution stays out of a Wednesday view).
 * `abiertas` uses the same clip. An `asOf` before the period only fills `abiertas` at that earlier day.
 * Without a period, only `abiertas` at `asOf` is filled.
 * Counts from windows of different length are not comparable; use `equivalentOperationalWeeks`.
 */
export function summarizeIncidents(episodes: readonly IncidentEpisode[], asOf: string, period?: IncidentPeriod): IncidentSummary {
  const failures = emptyBucket()
  const informational = emptyBucket()
  const validPeriod = period && isDay(period.start) && isDay(period.end) && period.start <= period.end ? period : undefined
  const periodActive = Boolean(validPeriod && isDay(asOf) && asOf >= validPeriod.start)
  const clip = !isDay(asOf) ? undefined : (!validPeriod || asOf < validPeriod.start ? asOf : (asOf < validPeriod.end ? asOf : validPeriod.end))
  if (clip) {
    for (const episode of episodes) {
      const viewed = episodeAt(episode, clip)
      if (!viewed) continue
      const bucket = viewed.countsAsFailure ? failures : informational
      if (viewed.status !== 'resuelta') bucket.abiertas.push(viewed)
      if (!periodActive || !validPeriod) continue
      if (viewed.firstSeenAt >= validPeriod.start) bucket.nuevas.push(viewed)
      else if (viewed.status !== 'resuelta') bucket.persistentes.push(viewed)
      if (viewed.resolvedAt && viewed.resolvedAt >= validPeriod.start) bucket.resueltas.push(viewed)
    }
  }
  for (const bucket of [failures, informational]) {
    bucket.nuevas.sort(byImpact)
    bucket.persistentes.sort(byImpact)
    bucket.resueltas.sort(byImpact)
    bucket.abiertas.sort(byImpact)
  }
  return {
    asOf: clip ?? asOf,
    ...(validPeriod ? { period: validPeriod, periodDayCount: inclusiveDayCount(validPeriod) } : {}),
    failures,
    informational,
  }
}

/** Account-less, externally unidentified episodes projected back to the current review issue list. Account-scoped episodes stay out of this blob. */
export function legacyIssuesAt(episodes: readonly IncidentEpisode[], clientId: string, service: WorkService, day: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  for (const option of ISSUE_TYPES) {
    const conditionClass = CLASS_BY_ISSUE[option.id]
    const match = episodes
      .map(episode => episodeAt(episode, day))
      .filter((episode): episode is IncidentEpisode => Boolean(episode && episode.status !== 'resuelta' && episode.clientId === clientId && episode.service === service && !episode.accountId && !episode.externalId && episode.conditionClass === conditionClass))
      .sort((a, b) => b.generation - a.generation)[0]
    if (match) issues.push(match.latestDetail ? { type: option.id, detail: match.latestDetail } : { type: option.id })
  }
  return issues
}
