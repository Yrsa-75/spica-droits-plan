-- Plan SPICA Droits : stockage versionné du plan de construction.
-- Aucune donnée personnelle hormis l'email de l'administrateur qui enregistre une version.

create extension if not exists pgcrypto with schema extensions;

-- Administrateurs autorisés à modifier le plan (géré uniquement en SQL, jamais via l'API)
create table public.plan_admins (
  email text primary key check (email = lower(email))
);
alter table public.plan_admins enable row level security;

-- Réglages privés (empreinte du secret serveur de lecture)
create table public.plan_settings (
  key text primary key,
  value text not null
);
alter table public.plan_settings enable row level security;

-- Versions du plan : ajout seul, jamais de modification ni de suppression
create table public.plan_versions (
  id bigint generated always as identity primary key,
  data jsonb not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_by_email text default lower(auth.jwt() ->> 'email')
);
alter table public.plan_versions enable row level security;

create or replace function public.is_plan_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plan_admins where email = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_plan_admin() from public, anon;
grant execute on function public.is_plan_admin() to authenticated;

create policy "admins lisent les versions" on public.plan_versions
  for select to authenticated using (public.is_plan_admin());
create policy "admins ajoutent une version" on public.plan_versions
  for insert to authenticated with check (public.is_plan_admin());

-- Empêche toute modification ou suppression, y compris par erreur
create or replace function public.plan_versions_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Les versions du plan sont en ajout seul';
end $$;
create trigger plan_versions_no_update before update or delete on public.plan_versions
  for each row execute function public.plan_versions_immutable();

-- Lecture du plan courant pour la page client : exige le secret serveur
create or replace function public.current_plan(viewer_secret text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('data', v.data, 'created_at', v.created_at)
  from public.plan_versions v
  where exists (
    select 1 from public.plan_settings s
    where s.key = 'viewer_secret_sha256'
      and s.value = encode(extensions.digest(viewer_secret, 'sha256'), 'hex')
  )
  order by v.id desc
  limit 1;
$$;
revoke all on function public.current_plan(text) from public;
grant execute on function public.current_plan(text) to anon, authenticated;
