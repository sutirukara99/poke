create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  save_version integer not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.cloud_saves enable row level security;

create policy "Users can read own cloud save"
on public.cloud_saves
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own cloud save"
on public.cloud_saves
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own cloud save"
on public.cloud_saves
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own cloud save"
on public.cloud_saves
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  reward jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.entitlements enable row level security;

create policy "Users can read own entitlements"
on public.entitlements
for select
to authenticated
using (auth.uid() = user_id);

-- Deliberately no client insert/update policy for entitlements.
-- Exclusive rewards should later be granted by a trusted server-side function.
