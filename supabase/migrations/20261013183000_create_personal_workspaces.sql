create table if not exists public.workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint workspace_data_object check (jsonb_typeof(data) = 'object')
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
create policy "workspace_select_own" on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "workspace_insert_own" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workspace_update_own" on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workspace_delete_own" on public.workspaces for delete to authenticated using ((select auth.uid()) = user_id);
