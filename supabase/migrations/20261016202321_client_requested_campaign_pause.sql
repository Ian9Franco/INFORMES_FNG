-- Allow a neutral client-requested campaign pause in the existing compact state.
-- Validation only: no customer IDs, no seed data, no history updates or backfill.
create or replace function public.fng_guard_platform_scope() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb; field text; allowed text[]; platform text:=new.payload->>'platform'; service text:=new.payload->>'service'; entry_platform text; entry_service text;
begin
 if new.kind='client' then
  foreach field in array array['services','archivedServices','archivedPlatforms'] loop
   if new.payload ? field then
    allowed:=case when field='archivedPlatforms' then array['meta_ads','google_ads'] else array['meta_ads','google_ads','meta_organic'] end;
    if jsonb_typeof(new.payload->field) is distinct from 'array' then raise exception 'Servicios/plataformas archivadas inválidas'; end if;
    if jsonb_array_length(new.payload->field)>cardinality(allowed) or exists(select 1 from jsonb_array_elements(new.payload->field) p where jsonb_typeof(p.value) is distinct from 'string' or not(p.value#>>'{}'=any(allowed))) or (select count(*)<>count(distinct value) from jsonb_array_elements(new.payload->field)) then raise exception 'Servicios/plataformas archivadas inválidas'; end if;
   end if;
  end loop;
 end if;
 if new.kind in ('review','task','action','event') and new.payload ? 'service' then
  if coalesce(service,'') not in ('meta_ads','google_ads','meta_organic') or platform is distinct from (case when service='google_ads' then 'google_ads' else 'meta_ads' end) then raise exception 'Servicio/proveedor inválido'; end if;
  if TG_OP='UPDATE' and old.payload ? 'service' and old.payload->>'service' is distinct from service then raise exception 'El servicio del registro es inmutable'; end if;
 end if;
 if new.kind in ('review','task') and new.payload ? 'platform' then
  if coalesce(platform,'') not in ('meta_ads','google_ads') then raise exception 'Plataforma inválida'; end if;
  if TG_OP='UPDATE' and old.payload ? 'platform' and old.payload->>'platform' is distinct from platform then raise exception 'La plataforma del registro es inmutable'; end if;
  if new.kind='review' then
   for entry in select value from jsonb_array_elements(coalesce(new.payload->'actionEntries','[]'::jsonb)) loop
    entry_platform:=case when entry->>'typeId' like 'google.%' then 'google_ads' when entry->>'typeId' like 'meta.%' then 'meta_ads' else entry->'customDefinition'->>'platform' end;
    entry_service:=case when entry->>'typeId' in ('meta.story.scheduled','meta.post.scheduled') then 'meta_organic' else coalesce(entry->'customDefinition'->>'service',entry_platform) end;
    if entry_platform is distinct from platform or (service is not null and entry_service is distinct from service) then raise exception 'La acción pertenece a otra plataforma o servicio'; end if;
   end loop;
  end if;
 end if;
 if new.kind='review' then
  if TG_OP='UPDATE' and old.payload ? 'issues' and not(new.payload ? 'issues') then raise exception 'Actualizá la aplicación para conservar las incidencias'; end if;
  if not new.deleted and not(new.payload ? 'issues') and exists(select 1 from public.fng_records r where r.user_id=new.user_id and r.kind='condition' and not r.deleted and r.payload->>'clientId'=new.payload->>'clientId' and r.payload->>'service'=coalesce(service,platform,'meta_ads') and jsonb_array_length(r.payload->'issues')>0) then raise exception 'Actualizá la aplicación para conservar las incidencias'; end if;
  if new.payload ? 'issues' then
   if jsonb_typeof(new.payload->'issues') is distinct from 'array' then raise exception 'Incidencias inválidas'; end if;
   if jsonb_array_length(new.payload->'issues')>3 or (select count(*)<>count(distinct value->>'type') from jsonb_array_elements(new.payload->'issues')) then raise exception 'Incidencias duplicadas o inválidas'; end if;
   for entry in select value from jsonb_array_elements(new.payload->'issues') loop
    if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'type','') not in ('no_budget','error','client_paused') or (entry ? 'detail' and (jsonb_typeof(entry->'detail') is distinct from 'string' or length(entry->>'detail')>600)) then raise exception 'Incidencia inválida'; end if;
    if entry->>'type'='client_paused' and coalesce(service,platform,'meta_ads')='meta_organic' then raise exception 'La pausa de campañas sólo corresponde a Meta Ads o Google Ads'; end if;
   end loop;
  end if;
 end if;
 return new;
end $$;
