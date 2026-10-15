/** Accounts are private per-user data loaded from Supabase, never a bundled seed. */
export type AdvertisingAccount = { platform: 'meta_ads' | 'google_ads'; accountId: string; owner: string }
export function formatAccountId(account: Pick<AdvertisingAccount, 'platform' | 'accountId'>): string {
  return account.platform === 'google_ads' && /^\d{10}$/.test(account.accountId) ? account.accountId.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3') : account.accountId
}
export const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('es').trim()
