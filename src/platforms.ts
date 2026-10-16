import type { Client, Review } from './data'
import { entryService } from './review-actions.ts'
import { WORK_SERVICES, reviewService, serviceLabel, serviceProvider, type WorkService } from './work-services.ts'

// Kept as exported aliases for existing callers; these are work services, not account types.
export const PLATFORMS = WORK_SERVICES
export const platformLabel = serviceLabel
export function clientPlatforms(client: Client): WorkService[] {
  if (client.services) return PLATFORMS.filter(service => client.services!.includes(service))
  const platforms = PLATFORMS.filter(platform => client.advertisingAccounts?.some(account => account.platform === serviceProvider(platform)))
  return platforms.length ? platforms : ['meta_ads'] // Unbound legacy clients remain visible, never assigned a fabricated ID.
}
export const platformActive = (client: Client, platform: WorkService) => client.active && clientPlatforms(client).includes(platform) && !(client.archivedServices ? client.archivedServices.includes(platform) : client.archivedPlatforms?.includes(serviceProvider(platform)))
export const activePlatforms = (client: Client) => clientPlatforms(client).filter(platform => platformActive(client,platform))
export function togglePlatform(client: Client, platform: WorkService): Client {
  const all = clientPlatforms(client)
  const archived = new Set(client.active ? client.archivedServices ?? all.filter(service => client.archivedPlatforms?.includes(serviceProvider(service))) : all)
  if(archived.has(platform)) archived.delete(platform); else archived.add(platform)
  return { ...client, active: all.some(item => !archived.has(item)), archivedServices: PLATFORMS.filter(item => archived.has(item)) }
}

/** Project old mixed records without writing on load. Materialize the full group on first edit.
 * Unscoped free notes stay exactly once, with Meta for mixed records; Google-only stays Google.
 */
export function scopedReviews(reviews: Review[], clients: Client[]): Review[] {
  const explicit = new Map(reviews.filter(review => review.service || review.platform && !review.actionEntries?.some(entry => entryService(entry) === 'meta_organic')).map(review => [`${review.clientId}:${review.date}:${reviewService(review)}`,review.id]))
  return reviews.flatMap(review => {
    if(review.service) return [review]
    const fromActions = PLATFORMS.filter(platform => review.actionEntries?.some(entry => entryService(entry) === platform))
    const client = clients.find(client => client.id === review.clientId)
    const platforms = fromActions.length ? fromActions : [review.platform ?? (client && clientPlatforms(client).length === 1 ? clientPlatforms(client)[0] : 'meta_ads')] as WorkService[]
    return platforms.filter(platform => { const owner = explicit.get(`${review.clientId}:${review.date}:${platform}`); return !owner || owner === review.id }).map(platform => ({
      ...review, platform: serviceProvider(platform), service: platform, id: platform === platforms[0] ? review.id : `${review.id}:${platform}`,
      revision: platform === platforms[0] ? review.revision : undefined,
      actions: platform === platforms[0] ? review.actions : '', observations: platform === platforms[0] ? review.observations : '',
      ...(platform !== platforms[0] ? { issues: [] } : {}),
      ...(review.actionEntries ? { actionEntries: review.actionEntries.filter(entry => entryService(entry) === platform) } : {}),
    }))
  })
}
