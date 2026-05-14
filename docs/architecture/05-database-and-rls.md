# 模块：数据库与权限模型

## 覆盖范围

- `supabase/migrations/20260508000000_init.sql`
- `supabase/migrations/20260508030000_atomic_role_update.sql`
- `supabase/migrations/20260511090000_add_note_lifecycle_status.sql`
- `lib/types.ts`
- `lib/tags.ts`
- `lib/note-lifecycle.ts`

## 数据模型图

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1"
  PROFILES ||--o{ NOTES : "1:N"

  AUTH_USERS {
    uuid id
    string email
  }

  PROFILES {
    uuid id
    text email
    app_role role
    text display_name
    timestamptz created_at
    timestamptz updated_at
  }

  NOTES {
    uuid id
    uuid user_id
    text title
    text source_url
    text marker
    text content
    jsonb ai_summary
    text ai_status
    text lifecycle_status
    timestamptz created_at
    timestamptz updated_at
  }
```

## 权限与约束图

```mermaid
flowchart TD
  AuthUser["auth.uid()"] --> ProfilePolicy["profiles RLS"]
  AuthUser --> NotePolicy["notes RLS"]
  AuthUser --> IsAdmin["is_admin(uuid)"]

  IsAdmin --> ProfilePolicy
  IsAdmin --> NotePolicy

  AdminRpc["update_profile_role_safely()"] --> Profiles["public.profiles"]
  NewUser["auth.users insert"] --> Trigger["handle_new_user()"]
  Trigger --> Profiles
  UpdateNote["notes update"] --> Timestamp["set_updated_at()"]
  UpdateProfile["profiles update"] --> Timestamp
```

## 关键约束

- `profiles.id` 与 `auth.users.id` 绑定，删除认证用户会级联删除资料。
- `notes.user_id` 指向 `profiles.id`，删除资料会级联删除笔记。
- `notes.ai_status` 目前允许：`idle / loading / done / error`
- `notes.lifecycle_status` 目前允许：`inbox / distilled / archived`

## RLS 规则摘要

### `public.profiles`

- 普通用户可读自己的资料。
- 管理员可读全部资料。
- 用户可创建自己的资料。
- 用户可更新自己的资料。
- 管理员可更新全部资料。

### `public.notes`

- 普通用户只能访问自己的笔记。
- 管理员可查看全部笔记。
- 普通用户只能创建、修改、删除自己的笔记。

## RPC 与触发器

- `handle_new_user()`：新注册用户自动补建 `profiles`
- `set_updated_at()`：统一刷新 `updated_at`
- `is_admin(uuid)`：RLS 和业务逻辑里的管理员判断
- `update_profile_role_safely()`：原子化修改角色并防止系统失去最后一个管理员

## 当前实现评价

- 优点：真正把权限约束放进了数据库，而不是只靠前端按钮隐藏。
- 主要问题：TypeScript 侧仍然使用手写接口 `[types.ts](</C:/Users/cmd41/Documents/New project/lib/types.ts:1>)`，没有使用 Supabase 生成类型，因此查询结果里出现了几处 `as unknown as Note`。

## 推荐演进

1. 引入 Supabase 生成的 Database Types。
2. 为 `notes` 查询定义更明确的 typed repository 或 query helpers。
3. 当 `marker` 未来演进成真正标签表时，再考虑把标签从 `text` 列迁移为关系模型；当前阶段没必要过早拆表。
