-- Première installation : charge la version initiale du plan (data/seed.json) si, et seulement si,
-- aucune version n'existe encore. Exige le secret serveur, comme current_plan.
-- Sans effet dès qu'une version existe : le plan ne se modifie ensuite que depuis /admin.

create or replace function public.init_plan(viewer_secret text, seed jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.plan_settings s
    where s.key = 'viewer_secret_sha256'
      and s.value = encode(extensions.digest(viewer_secret, 'sha256'), 'hex')
  ) then
    return false;
  end if;
  -- Évite un double chargement si deux visites arrivent en même temps
  perform pg_advisory_xact_lock(770011);
  if exists (select 1 from public.plan_versions) then
    return false;
  end if;
  insert into public.plan_versions (data, note) values (seed, 'Version initiale');
  return true;
end $$;
revoke all on function public.init_plan(text, jsonb) from public;
grant execute on function public.init_plan(text, jsonb) to anon, authenticated;
