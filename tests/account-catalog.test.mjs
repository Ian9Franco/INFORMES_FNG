import test from 'node:test'
import assert from 'node:assert/strict'
import { accountCatalog, reconcileAccounts } from '../src/account-catalog.ts'

test('the 34 supplied Meta accounts have unique string IDs, including the long Olivieri ID', () => {
  assert.equal(accountCatalog.length, 34)
  assert.equal(new Set(accountCatalog.map(account => account[1])).size, 34)
  assert.equal(accountCatalog.find(account => account[0] === 'OLIVIERI')[1], '26195611326734794')
})

test('migration preserves history, archive status and client IDs while matching explicit aliases', () => {
  const original = { clients: [{ id: 'old-regina', name: 'Regina Bistró', active: false }, { id: 'old-culpina', name: 'CARROCERÍAS CULPINA', active: true }, { id: 'old-corues', name: 'CORUÉS', active: true }], reviews: [{ clientId: 'old-regina', actions: 'Anterior' }], pending: [], closed: [] }
  const next = reconcileAccounts(original)
  const regina = next.clients.find(client => client.id === 'old-regina')
  assert.equal(regina.active, false)
  assert.equal(regina.advertisingAccounts[0].accountId, '1623440026062355')
  assert.equal(next.reviews, original.reviews)
  assert.equal(original.clients[0].advertisingAccounts, undefined)
  assert.equal(next.clients.find(client => client.id === 'old-corues').advertisingAccounts, undefined)
  assert.equal(next.clients.filter(client => client.name === 'COQUES').length, 1)
})

test('migration is idempotent and does not resurrect a deliberately deleted account', () => {
  const next = reconcileAccounts({ clients: [] })
  assert.equal(reconcileAccounts(next), next)
  const deleted = { ...next, clients: next.clients.filter(client => client.name !== 'BAEPACK') }
  assert.equal(reconcileAccounts(deleted).clients.some(client => client.name === 'BAEPACK'), false)
})
