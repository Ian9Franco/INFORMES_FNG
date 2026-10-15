-- Schema only. Real customer/account/context IDs are administered privately in Supabase.
create table public.fng_account_contexts (
 user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('meta_ads','google_ads')),
 context_kind text not null check(context_kind in ('google_context','meta_page')),
 context_key text not null,
 account_id text not null,
 primary key(user_id,context_kind,context_key),
 foreign key(user_id,platform,account_id) references public.fng_ad_accounts(user_id,platform,external_id) on delete cascade,
 check((context_kind='google_context' and platform='google_ads' and context_key ~ '^[0-9]{5,20}:[0-9]{5,20}$') or (context_kind='meta_page' and platform='meta_ads' and context_key ~ '^[0-9]{5,30}$'))
);
alter table public.fng_account_contexts enable row level security;
revoke all on public.fng_account_contexts from public,anon,authenticated;
grant select on public.fng_account_contexts to authenticated;
create policy fng_contexts_own on public.fng_account_contexts for select to authenticated using((select auth.uid())=user_id);
revoke insert,update,delete on public.fng_ad_accounts from authenticated;

create or replace function public.fng_bind_accounts() returns trigger language plpgsql security invoker set search_path='' as $$
declare account jsonb;
begin
 if new.kind<>'client' then return new; end if;
 if TG_OP='UPDATE' and new.payload->'advertisingAccounts' is not distinct from old.payload->'advertisingAccounts' and new.deleted=old.deleted then return new; end if;
 delete from public.fng_ad_accounts a where a.user_id=new.user_id and a.client_id=new.id and (new.deleted or not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'advertisingAccounts','[]'::jsonb)) v where v->>'platform'=a.platform and v->>'accountId'=a.external_id));
 if not new.deleted then
  for account in select value from jsonb_array_elements(coalesce(new.payload->'advertisingAccounts','[]'::jsonb)) loop
   if (account->>'platform'='meta_ads' and coalesce(account->>'accountId','') !~ '^[1-9][0-9]{0,29}$') or (account->>'platform'='google_ads' and coalesce(account->>'accountId','') !~ '^[0-9]{10}$') then raise exception 'ID de cuenta inválido'; end if;
   if exists(select 1 from public.fng_ad_accounts where user_id=new.user_id and platform=account->>'platform' and external_id=account->>'accountId' and client_id<>new.id) then raise exception 'Cuenta ya vinculada a otro cliente'; end if;
   insert into public.fng_ad_accounts(user_id,platform,external_id,client_id) values(new.user_id,account->>'platform',account->>'accountId',new.id) on conflict(user_id,platform,external_id) do nothing;
  end loop;
 end if;
 return new;
end $$;

create function public.fng_guard_client_catalog() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then
  if old.kind='client' then
   if current_user in ('authenticated','anon') then raise exception 'Clientes: administración exclusiva desde la base de datos' using errcode='42501'; end if;
   if exists(select 1 from public.fng_records where user_id=old.user_id and not deleted and (client_id=old.id or (kind='action' and payload->>'clientId'=old.id))) then raise exception 'Cliente con historial: archivar en lugar de eliminar'; end if;
  end if;
  return old;
 end if;
 if current_user in ('authenticated','anon') and (new.kind='client' or (TG_OP='UPDATE' and old.kind='client')) then
  if TG_OP='INSERT' then raise exception 'Clientes: administración exclusiva desde la base de datos' using errcode='42501'; end if;
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.kind is distinct from old.kind or new.deleted is distinct from old.deleted or (new.payload-'active') is distinct from (old.payload-'active') then raise exception 'Clientes: sólo se permite archivar o reactivar' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger fng_record_catalog_guard before insert or update or delete on public.fng_records for each row execute function public.fng_guard_client_catalog();
revoke all on function public.fng_guard_client_catalog() from public,anon;
grant execute on function public.fng_guard_client_catalog() to authenticated;

create function public.fng_companion_catalog() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select jsonb_build_object('version',1,
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('platform',a.platform,'accountId',a.external_id,'clientId',a.client_id,'name',r.payload->>'name','active',(r.payload->>'active')::boolean) order by a.platform,a.external_id) from public.fng_ad_accounts a join public.fng_records r on r.user_id=a.user_id and r.kind='client' and r.id=a.client_id and not r.deleted where a.user_id=uid),'[]'::jsonb),
  'contexts',coalesce((select jsonb_agg(jsonb_build_object('platform',c.platform,'kind',c.context_kind,'key',c.context_key,'accountId',c.account_id) order by c.context_kind,c.context_key) from public.fng_account_contexts c where c.user_id=uid),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.fng_companion_catalog() from public,anon;
grant execute on function public.fng_companion_catalog() to authenticated;
