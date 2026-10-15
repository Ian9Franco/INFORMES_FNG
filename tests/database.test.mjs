import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('isolated PostgreSQL: CAS, RLS, account matching, event deduplication and lifecycle guards', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create role anon; create role authenticated; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create table public.workspaces(user_id uuid,data jsonb);`)
    const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(file=>file.endsWith('.sql')&&!file.includes('create_personal_workspaces')).sort()
    for (const file of files) {
      const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8')
      await db.exec(sql.replace('alter publication supabase_realtime add table public.fng_records;',''))
    }
    const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002'
    await db.exec(`insert into auth.users values('${a}','a@example.invalid'),('${b}','b@example.invalid'); set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`)
    const write = changes => db.query('select * from public.fng_apply_changes($1::jsonb)',[JSON.stringify(changes)])
    const adminWrite=async changes=>{await db.exec('reset role');try{return await write(changes)}finally{await db.exec('set role authenticated')}}
    const client={kind:'client',id:'c',expectedVersion:0,payload:{id:'c',name:'CLIENTE',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'987654321',owner:''}]}}
    await assert.rejects(write([client]),/base de datos/)
    await adminWrite([client])
    const review={kind:'review',id:'r',expectedVersion:0,payload:{id:'r',clientId:'c',date:'2026-10-14',actions:'Acción',observations:'Nota',createdAt:'2026-10-14T12:00:00Z'}}
    await write([review])
    await assert.rejects(write([{...review,payload:{...review.payload,observations:'Stale'}}]),/FNG_CONFLICT/)
    await write([{...review,expectedVersion:1,payload:{...review.payload,observations:'Nueva'}}])
    assert.equal((await db.query("select version from public.fng_records where kind='review'")).rows[0].version,2)
    await assert.rejects(write([{...client,expectedVersion:1,deleted:true}]),/sólo se permite|historial/)
    await write([{kind:'closure',id:'2026-10-12',expectedVersion:0,payload:{id:'2026-10-12'}}])
    await assert.rejects(write([{...review,expectedVersion:2,payload:{...review.payload,observations:'Cerrada'}}]),/cerrada/)
    await write([{...review,expectedVersion:2,payload:{...review.payload,observations:'Restaurada'}},{kind:'closure',id:'2026-10-12',expectedVersion:1,deleted:true,payload:{id:'2026-10-12'}}])
    assert.equal((await db.query("select payload->>'observations' as note from public.fng_records where kind='review'")).rows[0].note,'Restaurada')
    const story={id:'s',typeId:'meta.story.scheduled',quantity:2,source:'manual',evidence:'user_confirmed',scheduledDays:['mon','thu']}
    const storyReview={...review,expectedVersion:3,payload:{...review.payload,actionSchemaVersion:1,actionEntries:[story]}}
    await write([storyReview])
    assert.deepEqual((await db.query("select payload->'actionEntries'->0->'scheduledDays' as days from public.fng_records where kind='review'")).rows[0].days,['mon','thu'])
    for(const scheduledDays of [[],['bad'],['mon','mon'],[1],[null]]) await assert.rejects(write([{...storyReview,expectedVersion:4,payload:{...storyReview.payload,actionEntries:[{...story,scheduledDays}]}}]),/Días programados/)
    await assert.rejects(write([{...storyReview,expectedVersion:4,payload:{...storyReview.payload,actionEntries:[{...story,quantity:0}]}}]),/Acción inválida/)
    const definition={id:'custom.00000000-0000-4000-8000-000000000003',label:'Actualicé catálogo',platform:'meta_ads',scope:'client',clientId:'c'}
    const custom={...story,id:'custom-entry',typeId:definition.id,customDefinition:definition}; delete custom.scheduledDays
    const customReview={...storyReview,expectedVersion:4,payload:{...storyReview.payload,actionEntries:[custom,{...story,id:'post',typeId:'meta.post.scheduled'}]}}
    // Reversed order must still create the definition before the review.
    await write([customReview,{kind:'action',id:definition.id,expectedVersion:0,payload:definition}])
    await assert.rejects(write([{...customReview,expectedVersion:5,payload:{...customReview.payload,actionEntries:[{...custom,customDefinition:{...definition,label:'Alterada'}}]}}]),/alterada/)
    await assert.rejects(write([{kind:'action',id:definition.id,expectedVersion:1,payload:{...definition,scope:'general'}}]),/general|inmutables/)
    await assert.rejects(write([{kind:'action',id:definition.id,expectedVersion:1,payload:definition,deleted:true}]),/historial/)
    const secondClient={...client,id:'d',payload:{id:'d',name:'OTRO',active:true}}
    await adminWrite([secondClient])
    const otherReview={...customReview,id:'other',expectedVersion:0,payload:{...customReview.payload,id:'other',clientId:'d'}}
    await assert.rejects(write([otherReview]),/otro cliente/)
    const general={...definition,id:'custom.00000000-0000-4000-8000-000000000004',scope:'general'}; delete general.clientId
    const generalEntry={...custom,typeId:general.id,customDefinition:general}
    await write([{...otherReview,payload:{...otherReview.payload,actionEntries:[generalEntry]}},{kind:'action',id:general.id,expectedVersion:0,payload:general}])
    await write([{...customReview,expectedVersion:5,payload:{...customReview.payload,actionEntries:[generalEntry]}}])
    await assert.rejects(write([{kind:'action',id:'custom.00000000-0000-4000-8000-000000000005',expectedVersion:0,payload:{...general,id:'custom.00000000-0000-4000-8000-000000000005'}}]),/unique/)
    const events=[{id:'00000000-0000-4000-8000-000000000999',platform:'meta_ads',accountCandidate:'987654321',startedAt:new Date(Date.now()-600000).toISOString(),endedAt:new Date().toISOString(),focusedMs:600000,navigationSignals:4}]
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)])
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)])
    const result=await db.query("select client_id, payload->>'clientId' as mapped from public.fng_records where kind='event'")
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].mapped,'c')
    await adminWrite([{...client,expectedVersion:1,payload:{...client.payload,advertisingAccounts:[...client.payload.advertisingAccounts,{platform:'google_ads',accountId:'9000000035',owner:'Urbano Propiedades'}]}},{kind:'client',id:'meta-only',expectedVersion:0,payload:{id:'meta-only',name:'META DISTINTO',active:true,advertisingAccounts:[{platform:'meta_ads',accountId:'9000000035',owner:''}]}}])
    const google={...events[0],id:'00000000-0000-4000-8000-000000000998',platform:'google_ads',accountCandidate:'9000000035'}
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify([google])])
    assert.equal((await db.query("select client_id from public.fng_records where kind='event' and id=$1",[google.id])).rows[0].client_id,'c','Same numeric ID on Meta must not affect Google mapping')
    const unmatched={...google,id:'00000000-0000-4000-8000-000000000997',accountCandidate:'9000000053'}
    await db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify([unmatched])])
    assert.equal((await db.query("select client_id from public.fng_records where kind='event' and id=$1",[unmatched.id])).rows[0].client_id,null)
    await db.exec(`reset role;insert into public.fng_account_contexts(user_id,platform,context_kind,context_key,account_id) values('${a}','google_ads','google_context','8000000001:8000000002','9000000035');set role authenticated;`)
    const catalog=(await db.query('select public.fng_companion_catalog() as catalog')).rows[0].catalog
    assert.equal(catalog.contexts.length,1)
    assert.equal(catalog.accounts.filter(account=>account.platform==='google_ads').length,1)
    await assert.rejects(write([{...client,expectedVersion:2,payload:{...client.payload,name:'Changed'}}]),/sólo se permite/)
    await assert.rejects(db.query("delete from public.fng_records where kind='client' and id='c'"),/base de datos/)
    await assert.rejects(db.query("delete from public.fng_ad_accounts"),/permission denied/)
    await assert.rejects(db.query("delete from public.fng_account_contexts"),/permission denied/)
    const live=(await db.query("select * from public.fng_records where kind='client' and id='c'")).rows[0]
    await write([{kind:'client',id:'c',expectedVersion:live.version,payload:{...live.payload,active:false}}])
    assert.equal((await db.query('select public.fng_companion_catalog() as catalog')).rows[0].catalog.contexts.length,1,'Archiving must preserve context links')
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`)
    assert.equal((await db.query('select * from public.fng_records')).rows.length,0)
    assert.deepEqual((await db.query('select public.fng_companion_catalog() as catalog')).rows[0].catalog,{version:1,accounts:[],contexts:[]})
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select public.fng_ingest_activity($1::jsonb)',[JSON.stringify(events)]),/permission denied/)
    await assert.rejects(db.query('select public.fng_companion_catalog()'),/permission denied/)
  } finally { await db.close() }
})
