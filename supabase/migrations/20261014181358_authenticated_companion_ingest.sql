create function public.fng_ingest_activity(events jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare event jsonb; matched text; start_time timestamptz; end_time timestamptz; accepted integer:=0; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>50 then raise exception 'Lote inválido'; end if;
 for event in select value from jsonb_array_elements(events) loop
  if coalesce(event->>'id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(event->>'platform','') not in ('meta_ads','google_ads') or jsonb_typeof(event->'focusedMs') is distinct from 'number' or jsonb_typeof(event->'navigationSignals') is distinct from 'number' then raise exception 'Evento inválido'; end if;
  start_time:=(event->>'startedAt')::timestamptz; end_time:=(event->>'endedAt')::timestamptz;
  if start_time is null or end_time is null or end_time<start_time or end_time>now()+interval '5 minutes' or end_time-start_time>interval '48 hours' or (event->>'focusedMs')::numeric<0 or (event->>'focusedMs')::numeric>extract(epoch from(end_time-start_time))*1000+70000 or (event->>'navigationSignals')::numeric not between 0 and 100000 then raise exception 'Tiempos inválidos'; end if;
  select client_id into matched from public.fng_ad_accounts where user_id=uid and platform=event->>'platform' and external_id=event->>'accountCandidate';
  insert into public.fng_records(user_id,kind,id,payload,client_id,review_date)
   values(uid,'event',event->>'id',jsonb_build_object('id',event->>'id','platform',event->>'platform','accountCandidate',event->>'accountCandidate','clientId',matched,'startedAt',start_time,'endedAt',end_time,'focusedMs',(event->>'focusedMs')::bigint,'navigationSignals',(event->>'navigationSignals')::integer,'date',(end_time at time zone 'America/Argentina/Buenos_Aires')::date,'status','pending'),matched,(end_time at time zone 'America/Argentina/Buenos_Aires')::date)
   on conflict(user_id,kind,id) do nothing;
  accepted:=accepted+1;
 end loop;
 return accepted;
end $$;
revoke all on function public.fng_ingest_activity(jsonb) from public,anon;
grant execute on function public.fng_ingest_activity(jsonb) to authenticated;
