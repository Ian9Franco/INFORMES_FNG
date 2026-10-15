create or replace function public.fng_guard_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb; day date;
begin
 if new.kind='client' and new.deleted then
  if exists(select 1 from public.fng_records where user_id=new.user_id and client_id=new.id and kind in ('review','task') and not deleted) then raise exception 'Este cliente tiene historial: archivá en lugar de eliminar'; end if;
 end if;
 if new.kind='task' and not new.deleted and not exists(select 1 from public.fng_records where user_id=new.user_id and kind='client' and id=new.payload->>'clientId' and not deleted) then raise exception 'Cliente inexistente'; end if;
 if new.kind='review' then
  day:=(new.payload->>'date')::date;
  if exists(select 1 from public.fng_records where user_id=new.user_id and kind='closure' and id=(day-((extract(dow from day)::integer+6)%7))::text and not deleted) then raise exception 'Semana cerrada: reabrila antes de editar'; end if;
  if new.payload ? 'actionEntries' then
   if jsonb_typeof(new.payload->'actionEntries') is distinct from 'array' or new.payload->>'actionSchemaVersion' is distinct from '1' or jsonb_array_length(new.payload->'actionEntries')>40 then raise exception 'Acciones inválidas'; end if;
   for entry in select value from jsonb_array_elements(new.payload->'actionEntries') loop
    if coalesce(entry->>'id','')='' or coalesce(entry->>'typeId','') not in ('meta.ad.created','meta.ad.deleted','meta.ad.updated','meta.ad.paused','meta.campaign.created','meta.adset.created','meta.budget.updated','meta.audience.updated','meta.story.scheduled','google.ad.created','google.ad.deleted','google.ad.updated','google.campaign.created','google.adgroup.created','google.keyword.updated','google.keyword.negative_added','google.youtube.video_uploaded','google.asset_group.updated','google.budget.updated','google.bidding.updated')
     or coalesce(entry->>'quantity','') !~ '^[1-9][0-9]{0,2}$'
     or coalesce(entry->>'source','') not in ('manual','companion')
     or coalesce(entry->>'evidence','') not in ('user_confirmed','observed')
     or (entry->>'source'='manual' and entry->>'evidence'<>'user_confirmed')
     or (entry->>'source'='companion' and coalesce(entry->>'sourceEventId','')='') then raise exception 'Acción inválida'; end if;

   if entry->>'typeId'='meta.story.scheduled' then
    if jsonb_typeof(entry->'scheduledDays') is distinct from 'array' then raise exception 'Días programados inválidos'; end if;
    if jsonb_array_length(entry->'scheduledDays') not between 1 and 7 then raise exception 'Días programados inválidos'; end if;
    if exists(select 1 from jsonb_array_elements(entry->'scheduledDays') d where jsonb_typeof(d.value) is distinct from 'string' or d.value#>>'{}' not in ('mon','tue','wed','thu','fri','sat','sun')) then raise exception 'Días programados inválidos'; end if;
    if (select count(*)<>count(distinct value) from jsonb_array_elements(entry->'scheduledDays')) then raise exception 'Días programados duplicados'; end if;
   elsif entry ? 'scheduledDays' then raise exception 'Días programados sólo corresponden a historias';
   end if;
   end loop;
   if (select count(*)<>count(distinct value->>'id') or count(*)<>count(distinct value->>'typeId') from jsonb_array_elements(new.payload->'actionEntries')) then raise exception 'Acciones duplicadas'; end if;
  end if;
 end if;
 return new;
end $$;

revoke all on function public.fng_guard_lifecycle() from public,anon;
grant execute on function public.fng_guard_lifecycle() to authenticated;
