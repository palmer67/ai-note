# AI Notes

AI Notes 是一个面向学习场景的全栈 AI 笔记应用。

你可以把优质文章保存下来，打一个轻量标记，然后让 AI 自动生成结构化拆解。这个项目不只是一个演示页面，而是一套完整可运行的样板，适合边做边学 AI 开发。

## 当前已完成的能力

### 用户侧

- 邮箱密码注册与登录
- 创建、编辑、删除文章笔记
- 按标题、标记、正文搜索
- 通过 URL 半自动导入文章标题与正文
- 对单篇笔记发起 AI 深度拆解
- 保存修改时保留已有 AI 分析结果
- 一键复制 AI 分析结果

### 管理员侧

- 查看全部用户
- 查看全部笔记
- 查看笔记归属用户、标记、AI 状态和正文预览
- 修改其他用户角色
- 按用户、AI 状态、关键词筛选后台笔记

## 技术栈

- **Next.js 16**
  前端页面和后端路由都在同一个项目里，适合学习全栈开发。

- **Supabase**
  提供认证、Postgres 数据库和 RLS（行级权限控制）。

- **DeepSeek API**
  用于文章 AI 拆解，当前走兼容 OpenAI SDK 的调用方式。

## 项目结构

```text
app/
  auth/                       登录 / 注册页面
  dashboard/                  用户工作台与管理员后台
  api/
    ai/analyze/               AI 分析接口
    admin/profiles/role/      管理员修改角色接口
    articles/import/          URL 导入接口
components/
  admin/                      管理后台组件
  forms/                      表单组件
  layout/                     页面框架
  notes/                      笔记列表、编辑器、AI 结果面板
lib/
  auth.ts                     登录上下文与管理员校验
  articles/                   URL 导入与正文提取逻辑
  openai/                     AI 调用逻辑（当前接 DeepSeek）
  supabase/                   Supabase 客户端与服务端封装
supabase/
  migrations/                 数据库初始化与修复 SQL
docs/plans/
  设计文档与实现计划
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

参考 [.env.example](./.env.example)，在项目根目录创建 `.env.local`：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的_supabase_publishable_key

DEEPSEEK_API_KEY=你的_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

### 3. 初始化 Supabase 数据库

先运行这份一键初始化 / 修复脚本：

[20260508020000_bootstrap_repair.sql](./supabase/migrations/20260508020000_bootstrap_repair.sql)

它会完成：

- 创建 `profiles` 表
- 创建 `notes` 表
- 创建触发器
- 创建管理员判断函数
- 开启 RLS
- 创建用户与管理员访问策略
- 创建“新注册用户自动生成 profile”的逻辑
- 刷新 schema 缓存

然后再运行这份补充迁移：

[20260508030000_atomic_role_update.sql](./supabase/migrations/20260508030000_atomic_role_update.sql)

它会完成：

- 创建数据库函数 `update_profile_role_safely(...)`
- 让管理员角色修改变成原子操作
- 避免并发情况下把最后一个管理员降没

### 4. 启动开发服务器

```bash
npm run dev
```

然后打开：

[http://localhost:3000](http://localhost:3000)

## 管理员账号设置

默认注册出来的是普通用户。

如果你想把某个账号提升为管理员，可以在 Supabase SQL Editor 执行：

```sql
update public.profiles
set role = 'admin'
where email = '你的邮箱';
```

重新登录后，右上角会出现 `管理后台`。

## 数据库数据在哪里看

### 登录账号

在 Supabase 左侧菜单：

`Authentication -> Users`

这里看的是“谁能登录系统”。

### 用户资料与角色

在：

`Table Editor -> public.profiles`

这里看的是业务里的用户资料，例如：

- 邮箱
- 角色
- 创建时间

### 笔记与 AI 结果

在：

`Table Editor -> public.notes`

这里看的是：

- 笔记标题
- 标记
- 正文
- AI 分析结果
- AI 状态

### 临时查数据

也可以直接在 `SQL Editor` 里执行：

```sql
select * from public.profiles;
select * from public.notes order by updated_at desc;
```

## AI 调用说明

当前项目使用 DeepSeek：

- 默认模型：`deepseek-v4-flash`
- 默认地址：`https://api.deepseek.com`

AI 结果要求返回固定 JSON 结构，包含：

- `topic`
- `coreArgument`
- `supportingEvidence`
- `bestFitScenarios`
- `takeaways`

这些结果会被保存回当前笔记，方便后续查看和后台管理。

## 权限规则

### 普通用户

- 只能查看自己的笔记
- 只能修改自己的笔记
- 不能进入管理后台

### 管理员

- 可以查看全部用户
- 可以查看全部笔记
- 可以修改其他用户角色
- 不能修改自己的角色
- 不能把系统里的最后一个管理员降级

## 后续可继续扩展

推荐优先级：

1. 笔记标签体系
2. 多篇笔记联合检索
3. 基于笔记的 AI 问答
4. 部署到线上

## 学习价值

这个项目适合用来理解这些全栈 AI 开发概念：

- 前端页面如何和数据交互
- 后端为什么要保护模型密钥
- Supabase 认证和业务用户资料的关系
- RLS 如何限制用户只能访问自己的数据
- 管理员权限如何落到真实接口里
- AI 输出如何回写数据库

## 注意事项

- `.env.local` 不要提交到 GitHub
- 如果你在聊天里暴露过 DeepSeek key，建议去 DeepSeek 后台重新生成新 key
- 如果 Supabase 改完表后页面仍提示 `schema cache` 相关错误，可以在 SQL Editor 执行：

```sql
NOTIFY pgrst, 'reload schema';
```

## 仓库

当前项目仓库：

`git@github.com:palmer67/ai-note.git`
