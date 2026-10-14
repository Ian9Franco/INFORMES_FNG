/** Meta account IDs are strings: some exceed JavaScript's safe integer range. */
export type AdvertisingAccount = { platform: 'meta_ads'; accountId: string; owner: string }
export const ACCOUNT_CATALOG_VERSION = 1
export const accountCatalog = [
  ['JONDE', '2980180415592669', 'Hotel Jonde', []],
  ['ALLEGRA', '1431562859020123', 'Multieventos Allegra', []],
  ['ALAZAN', '1124457119300091', 'Alazan', []],
  ['BAEPACK', '1324621553162000', 'Baepack', []],
  ['BELLEVISION', '1249941473868507', 'Bellevision', []],
  ['BOXCASES', '859215843700669', 'BOXCASES', []],
  ['CASA VELTRI', '3159084900919369', 'Casa Veltri', []],
  ['COQUES', '2991696354240303', 'Coques Bakery', []],
  ['CARROCERÍAS CULPINA', '1864042717478526', 'Carrocerías Culpina', ['CULPINA']],
  ['CAUCE', '1281369200286435', 'Cauce', []],
  ['DA MILÁN', '432641062752872', 'Da Milan', ['DA MILAN PUBLICIDAD']],
  ['ELECTRIC HOGAR', '627552358301784', 'Electric Hogar EXSP', []],
  ['CULPINA EXPEDITION', '1302113921588267', 'culpinaexpeditiontruck', ['EXPEDITION TRUCK']],
  ['HAEDO BARBER', '522684222342055', 'Haedo Barber', []],
  ['HOUSTON ARG', '1448906885568769', 'HOUSTON FUNDAS', []],
  ['INOXIDABLES PIERRI', '1611325350547885', 'Innoxidables Pierri', []],
  ['JOKER', '1055362504815092', 'Hotel Joker', []],
  ['LOBO CAFÉ', '391206457166076', 'Lobo Café', ['LOBO']],
  ['MAMBA', '1668925127032224', 'MAMBA CLUB', ['MAMBA CLUB']],
  ['NATIVO', '1913439919556294', 'nativoestudio.ba', []],
  ['OLIVIERI', '26195611326734794', 'Olivieri Propiedades', []],
  ['PANICHELLA-HERRERA', '770675351807201', 'Panichella-Herrera', []],
  ['PERRI', '698434689454474', 'Refrigeracion Perri y Asociados SRL', ['REFRIGERACIÓN PERRI']],
  ['REGINA', '1623440026062355', 'Regina Bistró', ['REGINA BISTRÓ']],
  ['ROKER', '278329582572852', 'Roker', []],
  ['SMART PRODUCTS', '1270116517926616', 'Smart Products', []],
  ['SORRENTO', '3521423411404806', 'Sorrento', ['SORRENTO - Solutions Engineering Team']],
  ['TOLENTINOS', '377416215366554', 'Tolentinos Helados', []],
  ['URBANO', '878047829796657', 'Urbano Propiedades', []],
  ['VALINOR', '111248619044119', 'Individual', []],
  ['WWSS', '877775663784004', 'Worldwide Services S.A.', []],
  ['ZOFFA', '716652929134735', 'ZOFFA', []],
  ['DORMILINDO', '2800770956704811', 'Individual', ['DORMILINDO - Lore Bar']],
  ['IMEK', '533662174871060', 'Individual', ['I-MEK - Sofia Fernandez', 'I-MEK']],
] as const

export const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('es').trim()

/** One-time, additive migration. Preserve IDs, history, archive status and manual account bindings. */
export function reconcileAccounts<T extends { clients: { id: string; name: string; active: boolean; advertisingAccounts?: AdvertisingAccount[] }[]; accountCatalogVersion?: number }>(store: T): T {
  if ((store.accountCatalogVersion ?? 0) >= ACCOUNT_CATALOG_VERSION) return store
  const clients = store.clients.map(client => ({ ...client }))
  for (const [name, accountId, owner, aliases] of accountCatalog) {
    if (clients.some(client => client.advertisingAccounts?.some(account => account.platform === 'meta_ads' && account.accountId === accountId))) continue
    const matches = clients.filter(client => [name, ...aliases].some(alias => normalizeName(alias) === normalizeName(client.name)))
    // Ambiguous names are not bound automatically; retain a separate, identifiable account.
    const existing = matches.length === 1 ? matches[0] : undefined
    const account: AdvertisingAccount = { platform: 'meta_ads', accountId, owner }
    if (existing) existing.advertisingAccounts = [...(existing.advertisingAccounts ?? []), account]
    else clients.push({ id: `meta-${accountId}`, name, active: true, advertisingAccounts: [account] })
  }
  return { ...store, clients, accountCatalogVersion: ACCOUNT_CATALOG_VERSION }
}
