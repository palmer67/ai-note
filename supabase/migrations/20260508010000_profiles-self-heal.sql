begin;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
);

drop policy if exists "Users can update their profile and admins can update all profiles" on public.profiles;
create policy "Users can update their profile and admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
)
with check (
  auth.uid() = id
  or public.is_admin(auth.uid())
);

commit;
