create or replace function public.fng_apply_changes(changes jsonb) returns setof public.fng_records language plpgsql security invoker set search_path='' as $$
declare change jsonb; existing public.fng_records; result public.fng_records; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>200 then raise exception 'Lote inválido'; end if;
 -- Serialize one user's batches to protect absent-row inserts and bootstrap races.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 for change in select value from jsonb_array_elements(changes) order by case when value->>'kind'='client' and not coalesce((value->>'deleted')::boolean,false) then 0 when value->>'kind'='closure' and coalesce((value->>'deleted')::boolean,false) then 0 when value->>'kind' in ('review','task') and coalesce((value->>'deleted')::boolean,false) then 1 when value->>'kind'='client' then 3 when value->>'kind'='closure' then 4 when value->>'kind'='settings' then 5 else 2 end loop
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
