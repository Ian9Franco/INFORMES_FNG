import test from 'node:test'
import assert from 'node:assert/strict'
import { latestIssues } from '../src/review-issues.ts'
import {
  deriveIncidentEpisodes,
  episodeAt,
  episodesFromReviews,
  equivalentOperationalWeeks,
  inclusiveDayCount,
  legacyIssuesAt,
  normalizeIncidentSignal,
  operationalWeek,
  previousOperationalWeek,
  signalsFromReviews,
  summarizeIncidents,
} from '../src/incident-episodes.ts'

const review = (extra = {}) => ({
  id: 'r1',
  clientId: 'c',
  platform: extra.service === 'google_ads' ? 'google_ads' : 'meta_ads',
  service: 'meta_ads',
  date: '2026-10-12',
  createdAt: '2026-10-12T12:00:00.000Z',
  actions: '',
  observations: '',
  ...extra,
})
const signature = issues => issues.map(issue => `${issue.type}|${issue.detail ?? ''}`).sort()
const week = operationalWeek('2026-10-16')

test('the same warning across several days is one open episode and the reviews stay intact', () => {
  const reviews = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((date, index) => review({
    id: `r${index}`,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    issues: [{ type: 'error', detail: index === 3 ? 'Sigue el rechazo del pago' : 'Pago rechazado' }],
    observations: 'Nota libre que no es una incidencia nueva',
  }))
  const snapshot = structuredClone(reviews)
  const episodes = episodesFromReviews(reviews)
  assert.deepEqual(reviews, snapshot)
  assert.equal(episodes.length, 1)
  assert.equal(episodes[0].status, 'detectada')
  assert.equal(episodes[0].countsAsFailure, true)
  assert.equal(episodes[0].firstSeenAt, '2026-10-12')
  assert.equal(episodes[0].lastSeenAt, '2026-10-15')
  assert.equal(episodes[0].resolvedAt, undefined)
  assert.equal(episodes[0].observations.filter(item => item.signal === 'present').length, 4)
  assert.equal(episodes[0].latestDetail, 'Sigue el rechazo del pago')
  assert.equal(JSON.stringify(episodes).includes('Nota libre'), false)
  const summary = summarizeIncidents(episodes, '2026-10-17', week)
  assert.equal(summary.failures.abiertas.length, 1)
  assert.equal(summary.failures.nuevas.length, 1)
  assert.equal(summary.failures.persistentes.length, 0)
  assert.deepEqual(Object.keys(summary).sort(), ['asOf', 'failures', 'informational', 'period', 'periodDayCount'])
})

test('an explicit manual clear resolves once, keeps every review, and a later sighting reopens a new generation', () => {
  const reviews = [
    review({ id: 'seen', issues: [{ type: 'error', detail: 'Pago rechazado' }] }),
    review({ id: 'clear', date: '2026-10-13', createdAt: '2026-10-13T12:00:00.000Z', issues: [] }),
    review({ id: 'again', date: '2026-10-16', createdAt: '2026-10-16T12:00:00.000Z', issues: [{ type: 'error', detail: 'Volvió el rechazo' }] }),
  ]
  const snapshot = structuredClone(reviews)
  const episodes = episodesFromReviews(reviews)
  assert.deepEqual(reviews, snapshot)
  assert.equal(reviews[0].issues[0].detail, 'Pago rechazado')
  assert.equal(episodes.length, 2)
  assert.equal(episodes[0].generation, 1)
  assert.equal(episodes[0].status, 'resuelta')
  assert.equal(episodes[0].resolvedAt, '2026-10-13')
  assert.equal(episodes[0].resolution, 'manual')
  assert.equal(episodes[0].lastSeenAt, '2026-10-12')
  assert.equal(episodes[1].generation, 2)
  assert.equal(episodes[1].status, 'detectada')
  assert.equal(episodes[1].previousEpisodeId, episodes[0].id)
  assert.equal(episodes[1].firstSeenAt, '2026-10-16')
  const summary = summarizeIncidents(episodes, week.end, week)
  assert.equal(summary.failures.abiertas.length, 1)
  assert.equal(summary.failures.abiertas[0].generation, 2)
  assert.equal(summary.failures.resueltas.length, 1)
  assert.equal(summary.failures.nuevas.length, 2)
  const wednesday = episodeAt(episodes[0], '2026-10-12')
  assert.equal(wednesday.status, 'detectada')
  assert.equal(wednesday.resolvedAt, undefined)
  assert.equal(episodeAt(episodes[0], '2026-10-13').status, 'resuelta')
})

test('omitting the issues key, a silent day, or a non-manual clear does not resolve', () => {
  const seen = review({ issues: [{ type: 'no_budget', detail: 'Esperando recarga' }] })
  const outdated = review({ id: 'old-app', date: '2026-10-13', createdAt: '2026-10-13T12:00:00.000Z' })
  delete outdated.issues
  const carried = episodesFromReviews([seen, outdated])
  assert.equal(carried[0].status, 'detectada')
  assert.equal(carried[0].observations.length, 1)
  assert.deepEqual(legacyIssuesAt(carried, 'c', 'meta_ads', '2026-10-13'), [{ type: 'no_budget', detail: 'Esperando recarga' }])
  assert.deepEqual(latestIssues([seen, outdated], 'c', 'meta_ads', '2026-10-13'), [])
  const states = [{ id: 'status', clientId: 'c', service: 'meta_ads', date: '2026-10-12', reviewId: 'r1', issues: seen.issues }]
  assert.deepEqual(latestIssues([seen, outdated], 'c', 'meta_ads', '2026-10-13', states), seen.issues)
  const gapped = episodesFromReviews([
    seen,
    review({ id: 'later', date: '2026-10-15', createdAt: '2026-10-15T12:00:00.000Z', issues: seen.issues }),
  ])
  assert.equal(gapped.length, 1)
  assert.equal(gapped[0].status, 'detectada')
  assert.equal(gapped[0].lastSeenAt, '2026-10-15')
  const api = deriveIncidentEpisodes([
    { clientId: 'c', service: 'meta_ads', conditionClass: 'technical_or_policy', externalId: 'camp-1', date: '2026-10-12', origin: 'api', signal: 'present', detail: 'Rechazo' },
    { clientId: 'c', service: 'meta_ads', conditionClass: 'technical_or_policy', externalId: 'camp-1', date: '2026-10-13', origin: 'api', signal: 'cleared' },
    { clientId: 'c', service: 'meta_ads', conditionClass: 'technical_or_policy', externalId: 'camp-1', date: '2026-10-14', origin: 'csv', signal: 'insufficient' },
  ])
  assert.equal(api.length, 1)
  assert.equal(api[0].status, 'detectada')
  assert.equal(api[0].resolvedAt, undefined)
  assert.deepEqual(api[0].observations.map(item => item.signal), ['present', 'insufficient', 'insufficient'])
  assert.equal(deriveIncidentEpisodes([{ clientId: 'c', service: 'meta_ads', conditionClass: 'performance_anomaly', date: '2026-10-12', origin: 'csv', signal: 'insufficient' }]).length, 0)
})

test('distinct external ids and accounts do not collapse into the manual client-level issue', () => {
  const manual = review({ issues: [{ type: 'error', detail: 'Error de la cuenta' }] })
  const episodes = deriveIncidentEpisodes([
    ...signalsFromReviews([manual]),
    { clientId: 'c', service: 'meta_ads', accountId: '9000000000000001', conditionClass: 'technical_or_policy', externalId: 'camp-a', date: '2026-10-12', origin: 'api', signal: 'present', detail: 'Rechazo A' },
    { clientId: 'c', service: 'meta_ads', accountId: '9000000000000001', conditionClass: 'technical_or_policy', externalId: 'camp-b', date: '2026-10-12', origin: 'api', signal: 'present', detail: 'Rechazo B' },
    { clientId: 'c', service: 'meta_ads', accountId: '9000000000000001', conditionClass: 'technical_or_policy', externalId: 'camp-a', date: '2026-10-13', origin: 'api', signal: 'present', detail: 'Rechazo A' },
    { clientId: 'other', service: 'meta_ads', conditionClass: 'technical_or_policy', date: '2026-10-12', origin: 'manual', signal: 'present' },
    { clientId: 'c', service: 'google_ads', conditionClass: 'no_budget', date: '2026-10-12', origin: 'manual', signal: 'present' },
  ])
  assert.equal(episodes.length, 5)
  const repeated = episodes.find(episode => episode.externalId === 'camp-a')
  assert.equal(repeated.observations.length, 2)
  assert.equal(episodes.filter(episode => episode.externalId === 'camp-b').length, 1)
  assert.deepEqual(legacyIssuesAt(episodes, 'c', 'meta_ads', '2026-10-13'), [{ type: 'error', detail: 'Error de la cuenta' }])
  assert.deepEqual(legacyIssuesAt(episodes, 'c', 'google_ads', '2026-10-13'), [{ type: 'no_budget' }])
  assert.deepEqual(legacyIssuesAt(episodes, 'other', 'meta_ads', '2026-10-13'), [{ type: 'error' }])
})

test('a voluntary pause is tracked without counting as a failure, and organic cannot own one', () => {
  const reviews = [review({ issues: [{ type: 'client_paused', detail: 'Hasta nuevo aviso' }, { type: 'no_budget' }] })]
  const episodes = episodesFromReviews(reviews)
  const summary = summarizeIncidents(episodes, '2026-10-12', operationalWeek('2026-10-12'))
  assert.equal(summary.failures.abiertas.map(episode => episode.conditionClass).join(), 'no_budget')
  assert.equal(summary.informational.abiertas.map(episode => episode.conditionClass).join(), 'voluntary_pause')
  assert.equal(summary.informational.abiertas[0].countsAsFailure, false)
  assert.deepEqual(summary.failures.abiertas.map(episode => episode.conditionClass), ['no_budget'])
  const organic = episodesFromReviews([review({ service: 'meta_organic', platform: 'meta_ads', issues: [{ type: 'client_paused' }, { type: 'error', detail: 'Historia rechazada' }] })])
  assert.deepEqual(organic.map(episode => episode.conditionClass), ['technical_or_policy'])
  assert.equal(normalizeIncidentSignal({ clientId: 'c', service: 'meta_organic', conditionClass: 'voluntary_pause', date: '2026-10-12', origin: 'manual', signal: 'present' }), undefined)
})

test('open failures are ordered by impact, not by how many times they were repeated', () => {
  const reviews = [0, 1, 2].map(index => review({
    id: `budget-${index}`,
    date: `2026-10-1${2 + index}`,
    createdAt: `2026-10-1${2 + index}T12:00:00.000Z`,
    issues: [{ type: 'no_budget' }],
  }))
  reviews.push(review({ id: 'error', date: '2026-10-15', createdAt: '2026-10-15T15:00:00.000Z', issues: [{ type: 'error' }, { type: 'no_budget' }] }))
  const summary = summarizeIncidents(episodesFromReviews(reviews), '2026-10-17', week)
  assert.deepEqual(summary.failures.abiertas.map(episode => episode.conditionClass), ['technical_or_policy', 'no_budget'])
  assert.equal(summary.failures.abiertas[1].observations.filter(item => item.signal === 'present').length, 4)
})

test('explicit issue lists stay compatible with the current carry-forward, including same-day order', () => {
  const reviews = [
    review({ id: 'a', issues: [{ type: 'no_budget', detail: 'Esperando recarga' }] }),
    review({ id: 'b', date: '2026-10-13', createdAt: '2026-10-13T12:00:00.000Z', issues: [{ type: 'error', detail: 'Pago' }, { type: 'no_budget', detail: 'Esperando recarga' }] }),
    review({ id: 'morning', date: '2026-10-14', createdAt: '2026-10-14T12:00:00.000Z', issues: [{ type: 'error', detail: 'Pago' }] }),
    review({ id: 'afternoon', date: '2026-10-14', createdAt: '2026-10-14T18:00:00.000Z', issues: [{ type: 'client_paused', detail: 'Hasta nuevo aviso' }] }),
    review({ id: 'empty', date: '2026-10-15', createdAt: '2026-10-15T12:00:00.000Z', issues: [] }),
  ]
  const episodes = episodesFromReviews(reviews)
  for (const day of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']) {
    assert.deepEqual(signature(legacyIssuesAt(episodes, 'c', 'meta_ads', day)), signature(latestIssues(reviews, 'c', 'meta_ads', day)), day)
  }
  assert.deepEqual(latestIssues(reviews, 'c', 'meta_ads', '2026-10-14'), [{ type: 'client_paused', detail: 'Hasta nuevo aviso' }])
  const reversed = [
    review({ id: 'clear-first', date: '2026-10-14', createdAt: '2026-10-14T10:00:00.000Z', issues: [] }),
    review({ id: 'seen-later', date: '2026-10-14', createdAt: '2026-10-14T19:00:00.000Z', issues: [{ type: 'error' }] }),
  ]
  const sameDay = episodesFromReviews(reversed)
  assert.equal(sameDay.find(episode => episode.conditionClass === 'technical_or_policy').status, 'detectada')
  assert.deepEqual(legacyIssuesAt(sameDay, 'c', 'meta_ads', '2026-10-14'), latestIssues(reversed, 'c', 'meta_ads', '2026-10-14'))
})

test('workflow notes change follow-up state and never close an episode or create a task', () => {
  const annotation = { clientId: 'c', service: 'meta_ads', conditionClass: 'technical_or_policy', status: 'investigando', note: 'Falta el comprobante', at: '2026-10-13T15:00:00.000Z' }
  const episodes = episodesFromReviews([
    review({ issues: [{ type: 'error', detail: 'Pago rechazado' }] }),
    review({ id: 'still', date: '2026-10-14', createdAt: '2026-10-14T12:00:00.000Z', issues: [{ type: 'error', detail: 'Pago rechazado' }] }),
  ], [annotation, { ...annotation, status: 'resuelta', at: '2026-10-14T16:00:00.000Z', note: 'No puede cerrarse por nota' }])
  assert.equal(episodes.length, 1)
  assert.equal(episodes[0].status, 'investigando')
  assert.equal(episodes[0].resolvedAt, undefined)
  assert.equal(episodes[0].statusHistory.length, 1)
  assert.equal(episodeAt(episodes[0], '2026-10-12').status, 'detectada')
  assert.equal(JSON.stringify(episodes).includes('pending'), false)
  const resolved = episodesFromReviews([
    review({ issues: [{ type: 'error' }] }),
    review({ id: 'clear', date: '2026-10-13', createdAt: '2026-10-13T12:00:00.000Z', issues: [] }),
  ], [{ clientId: 'c', service: 'meta_ads', conditionClass: 'technical_or_policy', status: 'escalada_o_depende_de_terceros', at: '2026-10-14' }])
  assert.equal(resolved[0].status, 'resuelta')
  assert.equal(resolved[0].statusHistory.length, 0)
})

test('period buckets separate new, persistent and resolved episodes without treating a short week as equivalent', () => {
  const episodes = episodesFromReviews([
    review({ id: 'old', date: '2026-10-08', createdAt: '2026-10-08T12:00:00.000Z', issues: [{ type: 'error', detail: 'Viene de antes' }] }),
    review({ id: 'still', date: '2026-10-13', createdAt: '2026-10-13T12:00:00.000Z', issues: [{ type: 'error', detail: 'Viene de antes' }, { type: 'no_budget' }] }),
    review({ id: 'budget-gone', date: '2026-10-15', createdAt: '2026-10-15T12:00:00.000Z', issues: [{ type: 'error', detail: 'Viene de antes' }] }),
  ])
  const summary = summarizeIncidents(episodes, week.end, week)
  assert.deepEqual(summary.failures.persistentes.map(episode => episode.conditionClass), ['technical_or_policy'])
  assert.deepEqual(summary.failures.nuevas.map(episode => episode.conditionClass), ['no_budget'])
  assert.deepEqual(summary.failures.resueltas.map(episode => episode.conditionClass), ['no_budget'])
  assert.deepEqual(summary.failures.abiertas.map(episode => episode.conditionClass), ['technical_or_policy'])
  const midweek = summarizeIncidents(episodes, '2026-10-14', week)
  assert.equal(midweek.asOf, '2026-10-14')
  assert.equal(midweek.failures.resueltas.length, 0)
  assert.deepEqual(midweek.failures.abiertas.map(episode => episode.conditionClass), ['technical_or_policy', 'no_budget'])
  const partial = { start: '2026-10-12', end: '2026-10-14' }
  assert.equal(summary.periodDayCount, 6)
  assert.equal(inclusiveDayCount(partial), 3)
  assert.equal(equivalentOperationalWeeks(week, previousOperationalWeek('2026-10-16')), true)
  assert.equal(equivalentOperationalWeeks(week, partial), false)
  assert.deepEqual(previousOperationalWeek('2026-10-16'), { start: '2026-10-05', end: '2026-10-10' })
  const before = summarizeIncidents(episodes, '2026-10-09', week)
  assert.equal(before.failures.nuevas.length, 0)
  assert.equal(before.failures.abiertas.length, 1)
})

test('repeating a csv row updates the same observation instead of opening another episode', () => {
  const row = { clientId: 'c', service: 'google_ads', accountId: '9000000001', conditionClass: 'performance_anomaly', date: '2026-10-12', origin: 'csv', signal: 'present', detail: 'CPA alto', recordedAt: '2026-10-13T00:00:00.000Z' }
  const episodes = deriveIncidentEpisodes([
    row,
    { ...row, detail: 'CPA alto, revisado', recordedAt: '2026-10-13T06:00:00.000Z' },
    { ...row, signal: 'cleared', recordedAt: '2026-10-13T07:00:00.000Z' },
  ])
  assert.equal(episodes.length, 1)
  assert.equal(episodes[0].countsAsFailure, true)
  assert.equal(episodes[0].status, 'detectada')
  assert.equal(episodes[0].observations.length, 2)
  assert.equal(episodes[0].latestDetail, 'CPA alto, revisado')
  assert.equal(normalizeIncidentSignal({ ...row, detail: 'x'.repeat(601) }), undefined)
  assert.equal(normalizeIncidentSignal({ ...row, date: '13/10/2026' }), undefined)
})
