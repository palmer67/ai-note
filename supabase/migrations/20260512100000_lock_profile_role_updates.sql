begin;

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

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
  if actor_user_id <> auth.uid() then
    raise exception '只能以当前登录账号修改角色。';
  end if;

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

grant execute on function public.update_profile_role_safely(uuid, uuid, public.app_role) to authenticated;

commit;
