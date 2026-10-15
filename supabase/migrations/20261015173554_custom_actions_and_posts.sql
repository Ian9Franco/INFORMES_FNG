-- Actions reuse ownership/RLS, incremental sync and CAS.
alter table public.fng_records drop constraint fng_records_kind_check;
alter table public.fng_records add constraint fng_records_kind_check check (kind in ('client','action','review','task','closure','settings','event','subscription'));
create unique index fng_action_label_unique on public.fng_records(user_id,(payload->>'platform'),(payload->>'scope'),(coalesce(payload->>'clientId','')),(lower(payload->>'label'))) where kind='action' and not deleted;

create or replace function public.fng_guard_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb; day date; definition jsonb;
begin
 if new.kind='action' then
  if new.deleted then raise exception 'Las definiciones de acciones se conservan para el historial'; end if;
  if new.payload->>'id' is distinct from new.id or new.id !~ '^custom\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(new.payload->'label') is distinct from 'string' or length(btrim(new.payload->>'label')) not between 2 and 80
   or new.payload->>'label' <> btrim(new.payload->>'label')
   or coalesce(new.payload->>'platform','') not in ('meta_ads','google_ads')
   or coalesce(new.payload->>'scope','') not in ('client','general') then raise exception 'Definición de acción inválida'; end if;
  if new.payload->>'scope'='client' then
   if jsonb_typeof(new.payload->'clientId') is distinct from 'string' or not exists(select 1 from public.fng_records where user_id=new.user_id and kind='client' and id=new.payload->>'clientId' and not deleted) then raise exception 'Cliente de la acción inexistente'; end if;
  elsif new.payload ? 'clientId' then raise exception 'Una acción general no tiene cliente'; end if;
  if tg_op='UPDATE' and new.payload is distinct from old.payload then raise exception 'Las definiciones son inmutables para conservar el historial'; end if;
 end if;
 if new.kind='client' and new.deleted then
  if exists(select 1 from public.fng_records where user_id=new.user_id and client_id=new.id and kind in ('review','task') and not deleted) or exists(select 1 from public.fng_records where user_id=new.user_id and kind='action' and payload->>'clientId'=new.id and not deleted) then raise exception 'Este cliente tiene historial: archivá en lugar de eliminar'; end if;
 end if;
 if new.kind='task' and not new.deleted and not exists(select 1 from public.fng_records where user_id=new.user_id and kind='client' and id=new.payload->>'clientId' and not deleted) then raise exception 'Cliente inexistente'; end if;
 if new.kind='review' then
  day:=(new.payload->>'date')::date;
  if exists(select 1 from public.fng_records where user_id=new.user_id and kind='closure' and id=(day-((extract(dow from day)::integer+6)%7))::text and not deleted) then raise exception 'Semana cerrada: reabrila antes de editar'; end if;
  if new.payload ? 'actionEntries' then
   if jsonb_typeof(new.payload->'actionEntries') is distinct from 'array' or new.payload->>'actionSchemaVersion' is distinct from '1' or jsonb_array_length(new.payload->'actionEntries')>40 then raise exception 'Acciones inválidas'; end if;
   for entry in select value from jsonb_array_elements(new.payload->'actionEntries') loop
    if coalesce(entry->>'id','')='' or (coalesce(entry->>'typeId','') !~ '^custom\.' and coalesce(entry->>'typeId','') not in ('meta.ad.created','meta.ad.deleted','meta.ad.updated','meta.ad.paused','meta.campaign.created','meta.adset.created','meta.budget.updated','meta.audience.updated','meta.story.scheduled','meta.post.scheduled','google.ad.created','google.ad.deleted','google.ad.updated','google.campaign.created','google.adgroup.created','google.keyword.updated','google.keyword.negative_added','google.youtube.video_uploaded','google.asset_group.updated','google.budget.updated','google.bidding.updated'))
     or coalesce(entry->>'quantity','') !~ '^[1-9][0-9]{0,2}$'
     or coalesce(entry->>'source','') not in ('manual','companion')
     or coalesce(entry->>'evidence','') not in ('user_confirmed','observed')
     or (entry->>'source'='manual' and entry->>'evidence'<>'user_confirmed')
     or (entry->>'source'='companion' and coalesce(entry->>'sourceEventId','')='') then raise exception 'Acción inválida'; end if;

   if entry->>'typeId' like 'custom.%' then
    select payload into definition from public.fng_records where user_id=new.user_id and kind='action' and id=entry->>'typeId' and not deleted;
    if not found or entry->'customDefinition' is distinct from definition then raise exception 'Acción personalizada inexistente o alterada'; end if;
    if definition->>'scope'='client' and definition->>'clientId' is distinct from new.payload->>'clientId' then raise exception 'La acción pertenece a otro cliente'; end if;
   elsif entry ? 'customDefinition' then raise exception 'Una acción integrada no admite definición personalizada'; end if;
   if entry->>'typeId' in ('meta.story.scheduled','meta.post.scheduled') then
    if jsonb_typeof(entry->'scheduledDays') is distinct from 'array' then raise exception 'Días programados inválidos'; end if;
    if jsonb_array_length(entry->'scheduledDays') not between 1 and 7 then raise exception 'Días programados inválidos'; end if;
    if exists(select 1 from jsonb_array_elements(entry->'scheduledDays') d where jsonb_typeof(d.value) is distinct from 'string' or d.value#>>'{}' not in ('mon','tue','wed','thu','fri','sat','sun')) then raise exception 'Días programados inválidos'; end if;
    if (select count(*)<>count(distinct value) from jsonb_array_elements(entry->'scheduledDays')) then raise exception 'Días programados duplicados'; end if;
   elsif entry ? 'scheduledDays' then raise exception 'Días programados sólo corresponden a historias o publicaciones';
   end if;
   end loop;
   if (select count(*)<>count(distinct value->>'id') or count(*)<>count(distinct value->>'typeId') from jsonb_array_elements(new.payload->'actionEntries')) then raise exception 'Acciones duplicadas'; end if;
  end if;
 end if;
 return new;
end $$;

revoke all on function public.fng_guard_lifecycle() from public,anon;
grant execute on function public.fng_guard_lifecycle() to authenticated;

create or replace function public.fng_apply_changes(changes jsonb) returns setof public.fng_records language plpgsql security invoker set search_path='' as $$
declare change jsonb; existing public.fng_records; result public.fng_records; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>200 then raise exception 'Lote inválido'; end if;
 -- Serialize one user's batches to protect absent-row inserts and bootstrap races.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 for change in select value from jsonb_array_elements(changes) order by case when value->>'kind'='client' and not coalesce((value->>'deleted')::boolean,false) then 0 when value->>'kind'='closure' and coalesce((value->>'deleted')::boolean,false) then 0 when value->>'kind'='action' then 1 when value->>'kind' in ('review','task') and coalesce((value->>'deleted')::boolean,false) then 1 when value->>'kind'='client' then 3 when value->>'kind'='closure' then 4 when value->>'kind'='settings' then 5 else 2 end loop
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
