-- Staged Android release controls: admins decide when a tested build becomes visible.
create table if not exists public.app_release_control (
  id bigint primary key default 1,
  enabled boolean not null default false,
  latest_version text not null default '',
  latest_build bigint not null default 0,
  download_url text not null default '',
  whats_new jsonb not null default '[]'::jsonb,
  force_update boolean not null default false,
  minimum_supported_build bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.app_release_control (id) values (1)
on conflict (id) do nothing;

alter table public.app_release_control enable row level security;

drop policy if exists "public can read active app release" on public.app_release_control;
create policy "public can read active app release"
on public.app_release_control for select
using (enabled = true);

drop policy if exists "admins manage app release" on public.app_release_control;
create policy "admins manage app release"
on public.app_release_control for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
