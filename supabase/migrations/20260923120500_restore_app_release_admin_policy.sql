-- Restore the authenticated-admin policy for the staged Android release controls.
-- The live database was missing this policy, causing admin release saves/triggers
-- to fail with an RLS row-violation even though the admin console itself loaded.
drop policy if exists "admins manage app release" on public.app_release_control;

create policy "admins manage app release"
on public.app_release_control
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
