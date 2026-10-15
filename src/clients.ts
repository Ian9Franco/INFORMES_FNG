import type { Store } from './data'
const alphabet = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true })
export function sortClients<T extends { name: string; id: string }>(clients: readonly T[]): T[] {
  return [...clients].sort((a, b) => alphabet.compare(a.name, b.name) || a.id.localeCompare(b.id))
}
/** Backups restore operational records, never add/remove/rename/rebind managed clients. */
export function withManagedClients(current: Store, imported: Store): Store {
  const ids = new Set(current.clients.map(client => client.id))
  if ([...imported.reviews, ...imported.pending, ...(imported.customActions ?? []).filter(action => action.scope === 'client')].some(item => !item.clientId || !ids.has(item.clientId))) throw Error('El respaldo contiene clientes inexistentes. Administralos primero desde la base de datos.')
  return { ...imported, clients: current.clients, accountCatalogVersion: current.accountCatalogVersion }
}
