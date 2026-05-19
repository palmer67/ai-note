begin;

create table if not exists public.note_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint note_collections_name_check check (length(btrim(name)) > 0)
);

create table if not exists public.note_collection_items (
  collection_id uuid not null references public.note_collections (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (collection_id, note_id)
);

drop trigger if exists note_collections_set_updated_at on public.note_collections;
create trigger note_collections_set_updated_at
before update on public.note_collections
for each row
execute function public.set_updated_at();

create index if not exists note_collections_user_id_updated_at_idx
on public.note_collections (user_id, updated_at desc);

create index if not exists note_collection_items_collection_id_position_idx
on public.note_collection_items (collection_id, position asc);

create or replace function public.replace_note_collection_items(
  target_collection_id uuid,
  target_note_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  note_position integer := 0;
begin
  if not exists (
    select 1
    from public.note_collections
    where id = target_collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  ) then
    raise exception 'collection_not_found_or_not_owned';
  end if;

  delete from public.note_collection_items
  where collection_id = target_collection_id;

  foreach note_id in array coalesce(target_note_ids, array[]::uuid[])
  loop
    if not exists (
      select 1
      from public.notes
      where id = note_id
        and (
          user_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    ) then
      raise exception 'note_not_found_or_not_owned';
    end if;

    insert into public.note_collection_items (collection_id, note_id, position)
    values (target_collection_id, note_id, note_position)
    on conflict (collection_id, note_id)
    do update set position = excluded.position;

    note_position := note_position + 1;
  end loop;
end;
$$;

grant execute on function public.replace_note_collection_items(uuid, uuid[]) to authenticated;

grant select, insert, update, delete on public.note_collections to authenticated;
grant select, insert, update, delete on public.note_collection_items to authenticated;

alter table public.note_collections enable row level security;
alter table public.note_collection_items enable row level security;

drop policy if exists "Users can view their own collections and admins can view all collections" on public.note_collections;
create policy "Users can view their own collections and admins can view all collections"
on public.note_collections
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can create their own collections" on public.note_collections;
create policy "Users can create their own collections"
on public.note_collections
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can update their own collections" on public.note_collections;
create policy "Users can update their own collections"
on public.note_collections
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can delete their own collections" on public.note_collections;
create policy "Users can delete their own collections"
on public.note_collections
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can view items for their own collections" on public.note_collection_items;
create policy "Users can view items for their own collections"
on public.note_collection_items
for select
to authenticated
using (
  exists (
    select 1
    from public.note_collections
    where id = collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can create items for their own collections" on public.note_collection_items;
create policy "Users can create items for their own collections"
on public.note_collection_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.note_collections
    where id = collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
  and exists (
    select 1
    from public.notes
    where id = note_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can update items for their own collections" on public.note_collection_items;
create policy "Users can update items for their own collections"
on public.note_collection_items
for update
to authenticated
using (
  exists (
    select 1
    from public.note_collections
    where id = collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.note_collections
    where id = collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
  and exists (
    select 1
    from public.notes
    where id = note_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can delete items for their own collections" on public.note_collection_items;
create policy "Users can delete items for their own collections"
on public.note_collection_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.note_collections
    where id = collection_id
      and (
        user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

commit;
