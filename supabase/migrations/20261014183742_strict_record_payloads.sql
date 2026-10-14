create unique index fng_client_name_unique on public.fng_records(user_id,lower(payload->>'name')) where kind='client' and not deleted;
create function public.fng_check_payload_types() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
 if new.kind in ('client','review','task','event') and jsonb_typeof(new.payload->'id') is distinct from 'string' then raise exception 'ID debe ser texto'; end if;
 if new.kind='client' then
  if jsonb_typeof(new.payload->'name') is distinct from 'string' then raise exception 'Nombre debe ser texto'; end if;
  if new.payload ? 'advertisingAccounts' then
   if jsonb_typeof(new.payload->'advertisingAccounts') is distinct from 'array' or jsonb_array_length(new.payload->'advertisingAccounts')>20 then raise exception 'Cuentas inválidas'; end if;
   for entry in select value from jsonb_array_elements(new.payload->'advertisingAccounts') loop
    if jsonb_typeof(entry->'accountId') is distinct from 'string' or coalesce(length(entry->>'accountId'),0) not between 1 and 64 or coalesce(entry->>'platform','') not in ('meta_ads','google_ads') then raise exception 'Cuenta inválida'; end if;
   end loop;
  end if;
 elsif new.kind in ('review','task') and jsonb_typeof(new.payload->'clientId') is distinct from 'string' then raise exception 'Cliente debe ser texto';
 end if;
 if new.kind='review' then
  if coalesce(new.payload->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Fecha inválida'; end if;
  for entry in select value from jsonb_array_elements(coalesce(new.payload->'actionEntries','[]'::jsonb)) loop
   if jsonb_typeof(entry->'quantity') is distinct from 'number' or jsonb_typeof(entry->'id') is distinct from 'string' then raise exception 'Cantidad e ID de acción inválidos'; end if;
  end loop;
 end if;
 return new;
end $$;
create trigger fng_record_payload_types before insert or update on public.fng_records for each row execute function public.fng_check_payload_types();
revoke all on function public.fng_check_payload_types() from public,anon;
grant execute on function public.fng_check_payload_types() to authenticated;
