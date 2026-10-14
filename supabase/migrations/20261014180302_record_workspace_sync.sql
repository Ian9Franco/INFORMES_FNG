create table public.fng_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('client','review','task','closure','settings','event','subscription')),
 id text not null check (length(id) between 1 and 160),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
 version integer not null default 1 check (version>0),
 deleted boolean not null default false,
 review_date date,
 client_id text,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,kind,id)
);
create index fng_records_period_idx on public.fng_records(user_id,kind,review_date);
create unique index fng_review_day_unique on public.fng_records(user_id,client_id,review_date) where kind='review' and not deleted;
create table public.fng_ad_accounts (
 user_id uuid not null,
 platform text not null check (platform in ('meta_ads','google_ads')),
 external_id text not null check (length(external_id) between 1 and 64),
 client_kind text not null default 'client' check (client_kind='client'),
 client_id text not null,
 primary key(user_id,platform,external_id),
 foreign key(user_id,client_kind,client_id) references public.fng_records(user_id,kind,id) on delete cascade
);
alter table public.fng_records enable row level security;
alter table public.fng_ad_accounts enable row level security;
revoke all on public.fng_records, public.fng_ad_accounts from anon;
grant select,insert,update,delete on public.fng_records,public.fng_ad_accounts to authenticated;
create policy fng_records_own on public.fng_records for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy fng_accounts_own on public.fng_ad_accounts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create function public.fng_validate_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then new.version:=old.version+1; end if;
 new.updated_at:=clock_timestamp();
 if new.kind in ('client','review','task','event') and new.payload->>'id' is distinct from new.id then raise exception 'ID inválido'; end if;
 if new.kind='client' then
  if coalesce(length(trim(new.payload->>'name')),0)=0 or jsonb_typeof(new.payload->'active') is distinct from 'boolean' then raise exception 'Cliente inválido'; end if;
 elsif new.kind='review' then
  new.client_id:=new.payload->>'clientId';
  new.review_date:=(new.payload->>'date')::date;
  if new.client_id is null or new.review_date is null or jsonb_typeof(new.payload->'actions') is distinct from 'string' or jsonb_typeof(new.payload->'observations') is distinct from 'string' then raise exception 'Revisión inválida'; end if;
  if not exists(select 1 from public.fng_records where user_id=new.user_id and kind='client' and id=new.client_id and not deleted) then raise exception 'Cliente inexistente'; end if;
 elsif new.kind='task' then
  new.client_id:=new.payload->>'clientId';
  if new.client_id is null or jsonb_typeof(new.payload->'text') is distinct from 'string' or jsonb_typeof(new.payload->'resolved') is distinct from 'boolean' then raise exception 'Pendiente inválido'; end if;
 elsif new.kind='closure' then new.review_date:=new.id::date;
 end if;
 return new;
end $$;
create trigger fng_record_validate before insert or update on public.fng_records for each row execute function public.fng_validate_record();

create function public.fng_bind_accounts() returns trigger language plpgsql security invoker set search_path='' as $$
declare account jsonb;
begin
 if new.kind <> 'client' then return new; end if;
 delete from public.fng_ad_accounts where user_id=new.user_id and client_id=new.id;
 if not new.deleted then
  for account in select value from jsonb_array_elements(coalesce(new.payload->'advertisingAccounts','[]'::jsonb)) loop
   if account->>'platform'='meta_ads' and account->>'accountId' !~ '^[1-9][0-9]*$' then raise exception 'ID de cuenta inválido'; end if;
   insert into public.fng_ad_accounts(user_id,platform,external_id,client_id) values(new.user_id,account->>'platform',account->>'accountId',new.id);
  end loop;
 end if;
 return new;
end $$;
create trigger fng_record_accounts after insert or update on public.fng_records for each row execute function public.fng_bind_accounts();

create function public.fng_apply_changes(changes jsonb) returns setof public.fng_records language plpgsql security invoker set search_path='' as $$
declare change jsonb; existing public.fng_records; result public.fng_records; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>200 then raise exception 'Lote inválido'; end if;
 -- Serialize one user's batches to protect absent-row inserts and bootstrap races.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 for change in select value from jsonb_array_elements(changes) order by case value->>'kind' when 'client' then 0 when 'settings' then 2 else 1 end loop
  select * into existing from public.fng_records where user_id=uid and kind=change->>'kind' and id=change->>'id' for update;
  if found then
   if existing.payload=change->'payload' and existing.deleted=coalesce((change->>'deleted')::boolean,false) then return next existing; continue; end if;
   if existing.version<>coalesce((change->>'expectedVersion')::integer,0) then raise exception 'FNG_CONFLICT:%:%',existing.kind,existing.id using errcode='40001'; end if;
   update public.fng_records set payload=change->'payload',deleted=coalesce((change->>'deleted')::boolean,false) where user_id=uid and kind=existing.kind and id=existing.id returning * into result;
  else
   if coalesce((change->>'expectedVersion')::integer,0)<>0 then raise exception 'FNG_CONFLICT:%:%',change->>'kind',change->>'id' using errcode='40001'; end if;
   insert into public.fng_records(user_id,kind,id,payload,deleted) values(uid,change->>'kind',change->>'id',change->'payload',coalesce((change->>'deleted')::boolean,false)) returning * into result;
  end if;
  return next result;
 end loop;
end $$;
revoke all on function public.fng_apply_changes(jsonb),public.fng_validate_record(),public.fng_bind_accounts() from public,anon;
grant execute on function public.fng_apply_changes(jsonb),public.fng_validate_record(),public.fng_bind_accounts() to authenticated;

-- Preserve historical snapshots as rollback/backup; expand existing rows once.
insert into public.fng_records(user_id,kind,id,payload)
select w.user_id,'client',v->>'id',v from public.workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'clients','[]'::jsonb)) v;
insert into public.fng_records(user_id,kind,id,payload)
select w.user_id,'review',v->>'id',v from public.workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'reviews','[]'::jsonb)) v;
insert into public.fng_records(user_id,kind,id,payload)
select w.user_id,'task',v->>'id',v from public.workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'pending','[]'::jsonb)) v;
insert into public.fng_records(user_id,kind,id,payload)
select w.user_id,'closure',v#>>'{}',jsonb_build_object('id',v#>>'{}') from public.workspaces w cross join lateral jsonb_array_elements(coalesce(w.data->'closed','[]'::jsonb)) v;
insert into public.fng_records(user_id,kind,id,payload)
select user_id,'settings','workspace',jsonb_build_object('accountCatalogVersion',coalesce(data->'accountCatalogVersion','0'::jsonb)) from public.workspaces;

alter publication supabase_realtime add table public.fng_records;
