-- DA20 Planner: saved load sheets.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.load_sheets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  registration  text not null,
  within_limits boolean not null,
  -- Key numbers shown in the list (weights, CG, TODR / LDR...).
  summary       jsonb not null,
  -- Everything needed to reopen the sheet exactly: inputs and the aircraft data used.
  snapshot      jsonb not null
);

create index if not exists load_sheets_user_created on public.load_sheets (user_id, created_at desc);

-- Row level security: each user can only see, add and delete their own sheets.
-- There is deliberately no UPDATE policy: a saved sheet is a record and can't be changed.
alter table public.load_sheets enable row level security;

drop policy if exists "read own sheets" on public.load_sheets;
create policy "read own sheets" on public.load_sheets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "add own sheets" on public.load_sheets;
create policy "add own sheets" on public.load_sheets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own sheets" on public.load_sheets;
create policy "delete own sheets" on public.load_sheets
  for delete to authenticated using (auth.uid() = user_id);
