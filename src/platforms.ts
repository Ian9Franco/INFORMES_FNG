import type { AdPlatform, Client, Review } from './data'
import { entryDefinition } from './review-actions.ts'

export const PLATFORMS = ['meta_ads','google_ads'] as const
export const platformLabel = (platform: AdPlatform) => platform === 'meta_ads' ? 'Meta Ads' : 'Google Ads'
export function clientPlatforms(client: Client): AdPlatform[] {
  const platforms = PLATFORMS.filter(platform => client.advertisingAccounts?.some(account => account.platform === platform))
  return platforms.length ? platforms : ['meta_ads'] // Unbound legacy clients remain visible, never assigned a fabricated ID.
}
export const platformActive = (client: Client, platform: AdPlatform) => client.active && clientPlatforms(client).includes(platform) && !client.archivedPlatforms?.includes(platform)
export const activePlatforms = (client: Client) => clientPlatforms(client).filter(platform => platformActive(client,platform))
export function togglePlatform(client: Client, platform: AdPlatform): Client {
  const all = clientPlatforms(client)
  const archived = new Set(client.active ? client.archivedPlatforms ?? [] : all)
  if(archived.has(platform)) archived.delete(platform); else archived.add(platform)
  return { ...client, active: all.some(item => !archived.has(item)), archivedPlatforms: PLATFORMS.filter(item => archived.has(item)) }
}

/** Project old mixed records without writing on load. Materialize the full group on first edit.
 * Unscoped free notes stay exactly once, with Meta for mixed records; Google-only stays Google.
 */
export function scopedReviews(reviews: Review[], clients: Client[]): Review[] {
  const explicit = new Set(reviews.filter(review => review.platform).map(review => `${review.clientId}:${review.date}:${review.platform}`))
  return reviews.flatMap(review => {
    if(review.platform) return [review]
    const fromActions = PLATFORMS.filter(platform => review.actionEntries?.some(entry => entryDefinition(entry)?.platform === platform))
    const client = clients.find(client => client.id === review.clientId)
    const platforms = fromActions.length ? fromActions : [client && clientPlatforms(client).length === 1 ? clientPlatforms(client)[0] : 'meta_ads'] as AdPlatform[]
    return platforms.filter(platform => !explicit.has(`${review.clientId}:${review.date}:${platform}`)).map(platform => ({
      ...review, platform, id: platform === platforms[0] ? review.id : `${review.id}:${platform}`,
      revision: platform === platforms[0] ? review.revision : undefined,
      actions: platform === platforms[0] ? review.actions : '', observations: platform === platforms[0] ? review.observations : '',
      ...(review.actionEntries ? { actionEntries: review.actionEntries.filter(entry => entryDefinition(entry)?.platform === platform) } : {}),
    }))
  })
}
