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

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

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
