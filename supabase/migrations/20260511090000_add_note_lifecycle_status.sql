begin;

-- 生命周期字段给知识工作流用，历史数据默认先回填到 inbox。
alter table public.notes
add column if not exists lifecycle_status text;

update public.notes
set lifecycle_status = 'inbox'
where lifecycle_status is null;

alter table public.notes
alter column lifecycle_status set default 'inbox';

alter table public.notes
alter column lifecycle_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notes_lifecycle_status_check'
  ) then
    -- 现阶段先用 check constraint 控制状态集合，避免过早引入单独枚举迁移成本。
    alter table public.notes
    add constraint notes_lifecycle_status_check
    check (lifecycle_status in ('inbox', 'distilled', 'archived'));
  end if;
end
$$;

commit;
