begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'app_role'
  ) then
    create type public.app_role as enum ('admin', 'user');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'user',
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  source_url text,
  marker text,
  content text not null,
  ai_summary jsonb,
  ai_status text not null default 'idle' check (ai_status in ('idle', 'loading', 'done', 'error')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

create or replace function public.update_profile_role_safely(
  actor_user_id uuid,
  target_profile_id uuid,
  next_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
  admin_count integer;
begin
  select *
  into actor_profile
  from public.profiles
  where id = actor_user_id;

  if actor_profile.id is null or actor_profile.role <> 'admin' then
    raise exception '只有管理员可以修改角色。';
  end if;

  if actor_user_id = target_profile_id then
    raise exception '当前账号不能修改自己的角色。';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = target_profile_id
  for update;

  if target_profile.id is null then
    raise exception '没有找到要修改的用户。';
  end if;

  if target_profile.role = 'admin' and next_role = 'user' then
    perform id
    from public.profiles
    where role = 'admin'
    for update;

    select count(*)
    into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception '系统里至少要保留一个管理员。';
    end if;
  end if;

  update public.profiles
  set role = next_role
  where id = target_profile_id
  returning *
  into updated_profile;

  return updated_profile;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.update_profile_role_safely(uuid, uuid, public.app_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can view their profile and admins can view all profiles" on public.profiles;
create policy "Users can view their profile and admins can view all profiles"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
);

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

drop policy if exists "Users can view their own notes and admins can view all notes" on public.notes;
create policy "Users can view their own notes and admins can view all notes"
on public.notes
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can create their own notes" on public.notes;
create policy "Users can create their own notes"
on public.notes
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
on public.notes
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
on public.notes
for delete
to authenticated
using (
  auth.uid() = user_id
);

commit;
