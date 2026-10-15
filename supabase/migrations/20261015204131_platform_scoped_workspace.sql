-- No customer IDs or data backfill. Legacy history is projected and split only on explicit edit.
drop index public.fng_review_day_unique;
create unique index fng_review_day_unique on public.fng_records(user_id,client_id,review_date,(coalesce(payload->>'platform','legacy'))) where kind='review' and not deleted;

create or replace function public.fng_guard_client_catalog() returns trigger language plpgsql security invoker set search_path='' as $$
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
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.kind is distinct from old.kind or new.deleted is distinct from old.deleted or (new.payload-'active'-'archivedPlatforms') is distinct from (old.payload-'active'-'archivedPlatforms') then raise exception 'Clientes: sólo se permite archivar o reactivar por plataforma' using errcode='42501'; end if;
 end if;
 return new;
end $$;

create function public.fng_guard_platform_scope() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb; platform text:=new.payload->>'platform'; entry_platform text;
begin
 if new.kind='client' and new.payload ? 'archivedPlatforms' then
  if jsonb_typeof(new.payload->'archivedPlatforms') is distinct from 'array' then raise exception 'Plataformas archivadas inválidas'; end if;
  if jsonb_array_length(new.payload->'archivedPlatforms')>2 or exists(select 1 from jsonb_array_elements(new.payload->'archivedPlatforms') p where jsonb_typeof(p.value)<>'string' or p.value#>>'{}' not in ('meta_ads','google_ads')) or (select count(*)<>count(distinct value) from jsonb_array_elements(new.payload->'archivedPlatforms')) then raise exception 'Plataformas archivadas inválidas'; end if;
 end if;
 if new.kind in ('review','task') and new.payload ? 'platform' then
  if coalesce(platform,'') not in ('meta_ads','google_ads') then raise exception 'Plataforma inválida'; end if;
  if TG_OP='UPDATE' and old.payload ? 'platform' and old.payload->>'platform' is distinct from platform then raise exception 'La plataforma del registro es inmutable'; end if;
  if new.kind='review' then
   for entry in select value from jsonb_array_elements(coalesce(new.payload->'actionEntries','[]'::jsonb)) loop
    entry_platform:=case when entry->>'typeId' like 'google.%' then 'google_ads' when entry->>'typeId' like 'meta.%' then 'meta_ads' else entry->'customDefinition'->>'platform' end;
    if entry_platform is distinct from platform then raise exception 'La acción pertenece a otra plataforma'; end if;
   end loop;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.fng_guard_platform_scope() from public,anon;
grant execute on function public.fng_guard_platform_scope() to authenticated;
create trigger fng_record_platform_guard before insert or update on public.fng_records for each row execute function public.fng_guard_platform_scope();

create or replace function public.fng_companion_catalog() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select jsonb_build_object('version',1,
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('platform',a.platform,'accountId',a.external_id,'clientId',a.client_id,'name',r.payload->>'name','active',(r.payload->>'active')::boolean and not(coalesce(r.payload->'archivedPlatforms','[]'::jsonb)?a.platform)) order by a.platform,a.external_id) from public.fng_ad_accounts a join public.fng_records r on r.user_id=a.user_id and r.kind='client' and r.id=a.client_id and not r.deleted where a.user_id=uid),'[]'::jsonb),
  'contexts',coalesce((select jsonb_agg(jsonb_build_object('platform',c.platform,'kind',c.context_kind,'key',c.context_key,'accountId',c.account_id) order by c.context_kind,c.context_key) from public.fng_account_contexts c where c.user_id=uid),'[]'::jsonb)) into result;
 return result;
end $$;
