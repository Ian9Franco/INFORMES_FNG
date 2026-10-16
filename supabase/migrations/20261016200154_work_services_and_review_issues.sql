-- Additive metadata only: no IDs, no customer backfill, no history rewritten.
alter table public.fng_records drop constraint fng_records_kind_check;
alter table public.fng_records add constraint fng_records_kind_check check(kind in ('client','action','review','task','closure','settings','event','subscription','condition'));
drop index public.fng_review_day_unique;
create unique index fng_review_day_unique on public.fng_records(user_id,client_id,review_date,(coalesce(payload->>'service',payload->>'platform','legacy'))) where kind='review' and not deleted;
drop index public.fng_action_label_unique;
create unique index fng_action_label_unique on public.fng_records(user_id,(coalesce(payload->>'service',payload->>'platform')),(payload->>'scope'),(coalesce(payload->>'clientId','')),(lower(payload->>'label'))) where kind='action' and not deleted;

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
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.kind is distinct from old.kind or new.deleted is distinct from old.deleted or (new.payload-'active'-'archivedPlatforms'-'archivedServices') is distinct from (old.payload-'active'-'archivedPlatforms'-'archivedServices') then raise exception 'Clientes: sólo se permite archivar o reactivar por servicio' using errcode='42501'; end if;
 end if;
 return new;
end $$;

-- Tiny current-condition projection: at most one row/client/service, not a daily snapshot.
-- The browser cannot write this derived metadata; it saves the actual review only.
create function public.fng_guard_condition() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' and old.kind='review' and current_user in ('authenticated','anon') then raise exception 'Usá eliminación lógica para conservar el estado de incidencias' using errcode='42501'; end if;
 if ((TG_OP='DELETE' and old.kind='condition') or (TG_OP<>'DELETE' and new.kind='condition')) and current_user in ('authenticated','anon') and pg_trigger_depth()<2 then raise exception 'Estado de incidencia: derivado de revisiones, no editable directamente' using errcode='42501'; end if;
 if TG_OP='UPDATE' and old.kind='condition' and new.kind is distinct from old.kind then raise exception 'Tipo inmutable'; end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.fng_guard_condition() from public,anon;
grant execute on function public.fng_guard_condition() to authenticated;
create trigger fng_record_condition_guard before insert or update or delete on public.fng_records for each row execute function public.fng_guard_condition();

create function public.fng_project_condition() returns trigger language plpgsql security invoker set search_path='' as $$
declare service text; latest jsonb; state jsonb; state_id text;
begin
 if new.kind<>'review' then return new; end if;
 service:=coalesce(new.payload->>'service',new.payload->>'platform','meta_ads');
 state_id:='issue:'||md5(new.client_id||':'||service);
 if coalesce(new.payload->'issues','[]'::jsonb)='[]'::jsonb and not exists(select 1 from public.fng_records where user_id=new.user_id and kind='condition' and id=state_id) then return new; end if;
 select payload into latest from public.fng_records where user_id=new.user_id and kind='review' and client_id=new.client_id and not deleted and coalesce(payload->>'service',payload->>'platform','meta_ads')=service order by review_date desc,id desc limit 1;
 if latest is null then
  update public.fng_records set deleted=true,version=version+1,updated_at=now() where user_id=new.user_id and kind='condition' and id=state_id and not deleted;
  return new;
 end if;
 state:=jsonb_build_object('id',state_id,'clientId',new.client_id,'service',service,'date',latest->>'date','reviewId',latest->>'id','issues',coalesce(latest->'issues','[]'::jsonb));
 insert into public.fng_records(user_id,kind,id,payload,version,deleted) values(new.user_id,'condition',state_id,state,1,false)
 on conflict(user_id,kind,id) do update set payload=excluded.payload,version=public.fng_records.version+1,deleted=false,updated_at=now() where public.fng_records.payload is distinct from excluded.payload or public.fng_records.deleted;
 return new;
end $$;
revoke all on function public.fng_project_condition() from public,anon;
grant execute on function public.fng_project_condition() to authenticated;
create trigger fng_record_condition_projection after insert or update on public.fng_records for each row execute function public.fng_project_condition();

create or replace function public.fng_companion_catalog() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select jsonb_build_object('version',1,
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('platform',a.platform,'accountId',a.external_id,'clientId',a.client_id,'name',r.payload->>'name','active',(r.payload->>'active')::boolean and jsonb_array_length(s.services)>0,'services',s.services) order by a.platform,a.external_id)
   from public.fng_ad_accounts a join public.fng_records r on r.user_id=a.user_id and r.kind='client' and r.id=a.client_id and not r.deleted
   cross join lateral (select coalesce(jsonb_agg(v.service order by v.service),'[]'::jsonb) as services from (values('meta_ads'),('google_ads'),('meta_organic')) v(service)
    where (case when v.service='google_ads' then 'google_ads' else 'meta_ads' end)=a.platform
     and (not(r.payload ? 'services') or r.payload->'services' ? v.service)
     and (case when r.payload ? 'archivedServices' then not(r.payload->'archivedServices' ? v.service) else not(coalesce(r.payload->'archivedPlatforms','[]'::jsonb) ? a.platform) end)) s
   where a.user_id=uid),'[]'::jsonb),
  'contexts',coalesce((select jsonb_agg(jsonb_build_object('platform',c.platform,'kind',c.context_kind,'key',c.context_key,'accountId',c.account_id) order by c.context_kind,c.context_key) from public.fng_account_contexts c where c.user_id=uid),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.fng_ingest_activity(events jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare event jsonb; matched text; start_time timestamptz; end_time timestamptz; accepted integer:=0; uid uuid:=auth.uid(); service text;
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>50 then raise exception 'Lote inválido'; end if;
 for event in select value from jsonb_array_elements(events) loop
  service:=coalesce(event->>'service',event->>'platform');
  if coalesce(event->>'id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(event->>'platform','') not in ('meta_ads','google_ads') or service not in ('meta_ads','google_ads','meta_organic') or event->>'platform' is distinct from (case when service='google_ads' then 'google_ads' else 'meta_ads' end) or jsonb_typeof(event->'focusedMs') is distinct from 'number' or jsonb_typeof(event->'navigationSignals') is distinct from 'number' then raise exception 'Evento inválido'; end if;
  start_time:=(event->>'startedAt')::timestamptz; end_time:=(event->>'endedAt')::timestamptz;
  if start_time is null or end_time is null or end_time<start_time or end_time>now()+interval '5 minutes' or end_time-start_time>interval '48 hours' or (event->>'focusedMs')::numeric<0 or (event->>'focusedMs')::numeric>extract(epoch from(end_time-start_time))*1000+70000 or (event->>'navigationSignals')::numeric not between 0 and 100000 then raise exception 'Tiempos inválidos'; end if;
  select a.client_id into matched from public.fng_ad_accounts a join public.fng_records r on r.user_id=a.user_id and r.kind='client' and r.id=a.client_id and not r.deleted
   where a.user_id=uid and a.platform=event->>'platform' and a.external_id=event->>'accountCandidate' and (r.payload->>'active')::boolean
    and (not(r.payload ? 'services') or r.payload->'services' ? service)
    and (case when r.payload ? 'archivedServices' then not(r.payload->'archivedServices' ? service) else not(coalesce(r.payload->'archivedPlatforms','[]'::jsonb) ? a.platform) end);
  insert into public.fng_records(user_id,kind,id,payload,client_id,review_date)
   values(uid,'event',event->>'id',jsonb_build_object('id',event->>'id','platform',event->>'platform','service',service,'accountCandidate',event->>'accountCandidate','clientId',matched,'startedAt',start_time,'endedAt',end_time,'focusedMs',(event->>'focusedMs')::bigint,'navigationSignals',(event->>'navigationSignals')::integer,'date',(end_time at time zone 'America/Argentina/Buenos_Aires')::date,'status','pending'),matched,(end_time at time zone 'America/Argentina/Buenos_Aires')::date)
   on conflict(user_id,kind,id) do nothing;
  accepted:=accepted+1;
 end loop;
 return accepted;
end $$;

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
   if jsonb_array_length(new.payload->'issues')>2 or (select count(*)<>count(distinct value->>'type') from jsonb_array_elements(new.payload->'issues')) then raise exception 'Incidencias duplicadas o inválidas'; end if;
   for entry in select value from jsonb_array_elements(new.payload->'issues') loop
    if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'type','') not in ('no_budget','error') or (entry ? 'detail' and (jsonb_typeof(entry->'detail') is distinct from 'string' or length(entry->>'detail')>600)) then raise exception 'Incidencia inválida'; end if;
   end loop;
  end if;
 end if;
 return new;
end $$;
