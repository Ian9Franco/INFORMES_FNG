import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('SQL: independent services, read-only bounded condition projection, issue validation, clearing and RLS',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create role anon;create role authenticated;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table public.workspaces(user_id uuid,data jsonb);`)
    for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&!f.includes('create_personal_workspaces')).sort()) await db.exec((await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8')).replace('alter publication supabase_realtime add table public.fng_records;',''))
    const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002'
    await db.exec(`insert into auth.users values('${uid}','qa@example.invalid'),('${other}','other@example.invalid');select set_config('request.jwt.claim.sub','${uid}',false)`)
    const write=changes=>db.query('select * from public.fng_apply_changes($1::jsonb)',[JSON.stringify(changes)])
    const client={kind:'client',id:'c',expectedVersion:0,payload:{id:'c',name:'SERVICIOS',active:true,services:['meta_ads','google_ads','meta_organic'],advertisingAccounts:[{platform:'meta_ads',accountId:'9000000000000001',owner:''}]}}
    await write([client]);await db.exec('set role authenticated')
    const base={clientId:'c',date:'2026-10-16',createdAt:'2026-10-16T12:00:00Z',actions:'',observations:'',actionSchemaVersion:1,actionEntries:[]}
    const review=(id,service,extra={})=>({kind:'review',id,expectedVersion:0,payload:{...base,id,platform:service==='google_ads'?'google_ads':'meta_ads',service,issues:[],...extra}})
    const meta=review('m','meta_ads',{issues:[{type:'no_budget',detail:'Esperando recarga'}]})
    const organic=review('o','meta_organic',{actionEntries:[{id:'s',typeId:'meta.story.scheduled',quantity:2,source:'manual',evidence:'user_confirmed',scheduledDays:['sat','sun']}]})
    await write([meta,organic,review('g','google_ads')])
    assert.equal((await db.query("select count(*)::int as n from public.fng_records where kind='review'")).rows[0].n,3)
    assert.equal((await db.query("select count(*)::int as n from public.fng_records where kind='condition'")).rows[0].n,1)
    const condition=(await db.query("select * from public.fng_records where kind='condition'")).rows[0]
    const outdated=review('old-app','meta_ads',{date:'2026-10-17'});delete outdated.payload.issues
    await assert.rejects(write([outdated]),/Actualizá/)
    await assert.rejects(db.query("delete from public.fng_records where kind='review' and id='m'"),/eliminación lógica/)
    await assert.rejects(write([{kind:'condition',id:condition.id,expectedVersion:condition.version,payload:{...condition.payload,issues:[]}}]),/derivado/)
    await assert.rejects(db.query("delete from public.fng_records where kind='condition'"),/derivado/)
    await assert.rejects(write([{...client,expectedVersion:1,payload:{...client.payload,services:['google_ads']}}]),/sólo se permite/)
    for(const issues of [[{type:'bad'}],[{type:'error'},{type:'error'}],[{type:'error',detail:4}],[{type:'error',detail:'x'.repeat(601)}]]) await assert.rejects(write([review('bad','meta_ads',{date:'2026-10-17',issues})]),/Incidencia/)
    await assert.rejects(write([{...meta,expectedVersion:1,payload:{...meta.payload,service:'meta_organic'}}]),/inmutable/)
    await assert.rejects(write([review('cross','meta_ads',{date:'2026-10-17',actionEntries:organic.payload.actionEntries})]),/otra plataforma o servicio/)
    const next=review('n','meta_ads',{date:'2026-10-17',issues:meta.payload.issues})
    await write([next])
    const clear=review('clear','meta_ads',{date:'2026-10-18'})
    await write([clear])
    let states=(await db.query("select payload from public.fng_records where kind='condition' and not deleted")).rows
    assert.equal(states.length,1);assert.deepEqual(states[0].payload.issues,[]);assert.equal(states[0].payload.date,'2026-10-18')
    assert.deepEqual((await db.query("select payload->'issues' as issues from public.fng_records where id='m' and kind='review'")).rows[0].issues,meta.payload.issues,'Clearing must not rewrite older reports')
    await write([{...clear,expectedVersion:1,deleted:true}])
    states=(await db.query("select payload from public.fng_records where kind='condition' and not deleted")).rows
    assert.equal(states[0].payload.reviewId,'n');assert.deepEqual(states[0].payload.issues,meta.payload.issues)
    await write([{...client,expectedVersion:1,payload:{...client.payload,archivedServices:['meta_ads']}}])
    const account=(await db.query('select public.fng_companion_catalog() as c')).rows[0].c.accounts[0]
    assert.equal(account.active,true);assert.deepEqual(account.services,['meta_organic'],'Organic remains trackable with Ads archived')
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
    assert.equal((await db.query("select * from public.fng_records where kind='condition'")).rows.length,0)
  }finally{await db.close()}
})
