import test from 'node:test'
import assert from 'node:assert/strict'
import { newClient, sortClients } from '../src/clients.ts'

test('Spanish alphabetical order is accent-insensitive and does not mutate stored history', () => {
  const clients = [{ id: 'z', name: 'ZOFFA' }, { id: 'a', name: 'ÁLAZAN' }, { id: 'c', name: 'CAUCE' }, { id: 'b', name: 'BAEPACK' }]
  assert.deepEqual(sortClients(clients).map(client => client.name), ['ÁLAZAN', 'BAEPACK', 'CAUCE', 'ZOFFA'])
  assert.equal(clients[0].id, 'z')
})

test('a new client requires a numeric real-account identifier, kept as a string', () => {
  for (const id of ['', 'act_123', '123 456', '-5', '0', '01', 'abc']) assert.throws(() => newClient([], 'Cliente', id))
  assert.throws(() => newClient([], '', '12345'))
  const client = newClient([], '  Olivieri  ', '26195611326734794')
  assert.equal(client.name, 'OLIVIERI')
  assert.equal(client.advertisingAccounts[0].accountId, '26195611326734794')
  assert.equal(typeof client.advertisingAccounts[0].accountId, 'string')
  assert.match(client.id, /^[0-9a-f-]{36}$/)
})

test('duplicate names and account IDs are rejected even when the existing client is archived', () => {
  const existing = { ...newClient([], 'Regina', '1623440026062355'), active: false }
  assert.throws(() => newClient([existing], 'Régina', '99999'), /nombre/)
  assert.throws(() => newClient([existing], 'Otro', '1623440026062355'), /cuenta publicitaria/)
})
