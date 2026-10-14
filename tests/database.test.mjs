import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('isolated PostgreSQL: CAS, RLS, account matching, event deduplication and lifecycle guards', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create role anon; create role authenticated; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create table public.workspaces(user_id uuid,data jsonb);`)
    for (const file of ['20261014180302_record_workspace_sync.sql','20261014181358_authenticated_companion_ingest.sql','20261014181921_validate_record_lifecycle.sql','20261014183742_strict_record_payloads.sql','20261014184147_order_atomic_changes.sql']) {
      const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8')
      await db.exec(sql.replace('alter publication supabase_realtime add table public.fng_records;',''))
    }
    const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002'
    await db.exec(`insert into auth.users values('${a}','a@example.invalid'),('${b}','b@example.invalid'); set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`)
    const write = changes => db.query('select * from public.fng_apply_changes($1::jsonb)',[JSON.stringify(changes)])
    const client={kind:'client',id:'c',expectedVersion:0,payload:{id:'c',name:'CLIENTE',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'987654321',owner:''}]}}
    await write([client])
    const review={kind:'review',id:'r',expectedVersion:0,payload:{id:'r',clientId:'c',date:'2026-10-14',actions:'Acción',observations:'Nota',createdAt:'2026-10-14T12:00:00Z'}}
    await write([review])
    await assert.rejects(write([{...review,payload:{...review.payload,observations:'Stale'}}]),/FNG_CONFLICT/)
    await write([{...review,expectedVersion:1,payload:{...review.payload,observations:'Nueva'}}])
    assert.equal((await db.query("select version from public.fng_records where kind='review'")).rows[0].version,2)
    await assert.rejects(write([{...client,expectedVersion:1,deleted:true}]),/historial/)
    await write([{kind:'closure',id:'2026-10-12',expectedVersion:0,payload:{id:'2026-10-12'}}])
    await assert.rejects(write([{...review,expectedVersion:2,payload:{...review.payload,observations:'Cerrada'}}]),/cerrada/)
    await write([{...review,expectedVersion:2,payload:{...review.payload,observations:'Restaurada'}},{kind:'closure',id:'2026-10-12',expectedVersion:1,deleted:true,payload:{id:'2026-10-12'}}])
    assert.equal((await db.query("select payload->>'observations' as note from public.fng_records where kind='review'")).rows[0].note,'Restaurada')
    const events=[{id:'00000000-0000-4000-8000-000000000999',platform:'meta_ads',accountCandidate:'987654321',startedAt:new Date(Date.now()-600000).toISOString(),endedAt:new Date().toISOString(),focusedMs:600000,navigationSignals:4}]
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)])
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)])
    const result=await db.query("select client_id, payload->>'clientId' as mapped from public.fng_records where kind='event'")
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].mapped,'c')
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`)
    assert.equal((await db.query('select * from public.fng_records')).rows.length,0)
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)]),/permission denied/)
  } finally { await db.close() }
})
