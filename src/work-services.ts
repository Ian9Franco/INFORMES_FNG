/** Work services are independent of account providers and access permissions. */
export const WORK_SERVICES = ['meta_ads', 'google_ads', 'meta_organic'] as const
export type WorkService = typeof WORK_SERVICES[number]
export const serviceProvider = (service: WorkService): 'meta_ads' | 'google_ads' => service === 'google_ads' ? 'google_ads' : 'meta_ads'
export const serviceLabel = (service: WorkService) => service === 'meta_organic' ? 'Meta orgánico' : service === 'google_ads' ? 'Google Ads' : 'Meta Ads'
export const serviceShortLabel = (service: WorkService) => service === 'meta_organic' ? 'Orgánico' : service === 'google_ads' ? 'Google' : 'Meta Ads'
export const reviewService = (review: { service?: WorkService; platform?: 'meta_ads' | 'google_ads' }): WorkService => review.service ?? review.platform ?? 'meta_ads'
