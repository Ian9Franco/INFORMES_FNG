import type { Client } from './data'

const alphabet = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true })

export function sortClients<T extends { name: string; id: string }>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) => alphabet.compare(a.name, b.name) || a.id.localeCompare(b.id))
}

/** Decimal Meta IDs stay strings, including IDs beyond Number.MAX_SAFE_INTEGER. */
export function newClient(clients: readonly Client[], rawName: string, rawAccountId: string): Client {
  const name = rawName.trim().toLocaleUpperCase('es')
  const accountId = rawAccountId.trim()
  if (!name) throw new Error('Ingresá el nombre del cliente.')
  if (!/^[1-9][0-9]{0,29}$/.test(accountId)) throw new Error('Ingresá el ID numérico real de la cuenta de Meta, sin espacios ni el prefijo act_.')
  if (clients.some(client => alphabet.compare(client.name.trim(), name) === 0)) throw new Error('Ya existe un cliente con ese nombre. Revisá también los archivados.')
  if (clients.some(client => client.advertisingAccounts?.some(account => account.platform === 'meta_ads' && account.accountId === accountId))) throw new Error('Esta cuenta publicitaria ya está vinculada a otro cliente. Revisá también los archivados.')
  return { id: crypto.randomUUID(), name, active: true, advertisingAccounts: [{ platform: 'meta_ads', accountId, owner: '' }] }
}
