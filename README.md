# AI Notes

AI Notes 是一个面向学习与知识整理场景的全栈 AI 笔记应用。

你可以把在网上看到的优质文章保存进来，补上标签，交给 AI 做结构化分析，再继续围绕这篇笔记提问、筛选、导出和归档。这个项目不是一个静态演示页，而是一套已经跑通核心流程、适合继续迭代和学习全栈 AI 开发的真实产品骨架。

## 当前产品能力

### 用户工作台

- 邮箱密码注册、登录、退出登录
- 顶部明确展示当前登录邮箱与角色，避免“看起来像免登录”的误解
- 新建、编辑、删除笔记
- 通过 URL 半自动导入文章标题与正文
- URL 导入支持多策略提取：
  - Readability 正文解析
  - JSON-LD 兜底
  - DOM 选择器兜底
  - 浏览器渲染兜底，可处理部分动态页面或挑战页
- 按标题、标签、来源链接、正文内容和 AI 分析结果搜索
- 支持多标签输入与标签筛选
- 标签支持多种分隔符：
  - 英文逗号 `,`
  - 中文逗号 `，`
  - 分号 `;`
  - 中文分号 `；`
  - 顿号 `、`
- 知识工作流状态管理：
  - `待整理`
  - `已提炼`
  - `已归档`
- 顶部视图切换：
  - `全部`
  - `待整理`
  - `已提炼`
  - `已归档`
- 从搜索结果中把多篇笔记加入临时资料集，方便后续集中阅读和继续扩展多篇问答
- 对单篇笔记发起 AI 分析
- 基于单篇笔记继续做 AI 问答
- 保存笔记修改时保留已有 AI 分析结果
- 一键复制 AI 分析结果
- 本地导出 AI 分析内容：
  - 单篇导出：`Markdown / JSON / HTML`
  - 批量导出：`ZIP` 压缩包

### 管理员后台

- 查看全部用户
- 查看全部笔记
- 查看笔记归属用户、标签、生命周期状态、AI 状态和正文预览
- 修改其他用户角色
- 防止把系统里的最后一个管理员降级
- 按以下维度筛选后台笔记：
  - 用户
  - 生命周期状态
  - AI 状态
  - 标签
  - 关键词
- 对当前筛选结果执行 AI 分析导出

## 技术栈

- **Next.js 16**
  前端页面和后端接口放在同一个项目里，适合学习全栈开发。

- **Supabase**
  提供认证、Postgres 数据库和 RLS（行级权限控制）。

- **DeepSeek API**
  用于文章 AI 分析与问答，当前通过兼容 OpenAI SDK 的方式调用。

- **Readability + JSDOM**
  用于 URL 导入时的正文抽取增强。

- **Playwright Core**
  用于处理部分动态渲染页面的浏览器级兜底抓取。

- **JSZip**
  用于批量导出 AI 分析结果压缩包。

## 项目结构

```text
app/
  auth/                       登录 / 注册页面
  dashboard/                  用户工作台与管理员后台
  api/
    ai/analyze/               AI 分析接口
    ai/ask-note/              AI 问答接口
    admin/profiles/role/      管理员修改角色接口
    articles/import/          URL 导入接口
components/
  admin/                      管理后台组件
  forms/                      表单组件
  layout/                     页面框架
  notes/                      笔记列表、编辑器、AI 面板
lib/
  articles/                   URL 导入与正文提取逻辑
  auth.ts                     登录上下文与管理员校验
  exports/                    AI 分析导出逻辑
  note-lifecycle.ts           生命周期状态配置
  openai/                     AI 调用逻辑（当前接 DeepSeek）
  supabase/                   Supabase 客户端与服务端封装
  tags.ts                     标签解析与标准化
supabase/
  migrations/                 数据库初始化与后续迁移 SQL
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

如果你是第一次启动项目，建议按下面顺序在 Supabase `SQL Editor` 里执行：

- [20260508020000_bootstrap_repair.sql](./supabase/migrations/20260508020000_bootstrap_repair.sql)
- [20260508030000_atomic_role_update.sql](./supabase/migrations/20260508030000_atomic_role_update.sql)
- [20260511090000_add_note_lifecycle_status.sql](./supabase/migrations/20260511090000_add_note_lifecycle_status.sql)

这些脚本会完成：

- 创建 `profiles` 表
- 创建 `notes` 表
- 创建更新时间触发器
- 创建新注册用户自动补齐 `profile` 的逻辑
- 创建管理员判断与角色修改能力
- 开启并配置 RLS
- 增加笔记生命周期字段 `lifecycle_status`

如果改完表结构后页面仍提示 `schema cache` 相关错误，可以在 `SQL Editor` 里执行：

```sql
NOTIFY pgrst, 'reload schema';
```

### 4. 启动开发服务器

```bash
npm run dev
```

然后打开：

[http://localhost:3000](http://localhost:3000)

### 5. 日常恢复项目时要不要启动数据库网页

一般不用。

Supabase 是云端托管服务，日常恢复项目通常只需要：

```bash
cd "C:\Users\cmd41\Documents\New project"
npm run dev
```

只有在这些场景下你才需要打开 Supabase 网页：

- 查看 `profiles` / `notes` 数据
- 跑 SQL
- 查看 `Authentication -> Users`
- 检查项目配置或 API Key

## 管理员账号设置

默认注册出来的是普通用户。

如果你想把某个账号提升为管理员，可以在 Supabase `SQL Editor` 执行：

```sql
update public.profiles
set role = 'admin'
where email = '你的邮箱';
```

重新登录后，顶部导航会出现 `管理后台`。

## 数据库数据在哪里看

### 登录账号

`Authentication -> Users`

这里看的是谁可以登录系统。

### 用户资料与角色

`Table Editor -> public.profiles`

这里看的是业务里的用户资料，例如：

- 邮箱
- 角色
- 创建时间

### 笔记与 AI 结果

`Table Editor -> public.notes`

这里可以看到：

- 笔记标题
- 标签
- 正文
- 生命周期状态
- AI 状态
- AI 分析结果

也可以在 `SQL Editor` 里直接执行：

```sql
select * from public.profiles;
select * from public.notes order by updated_at desc;
```

## AI 分析与导出说明

当前 AI 分析结果固定为结构化输出，包含：

- `topic`
- `coreArgument`
- `supportingEvidence`
- `bestFitScenarios`
- `takeaways`

这些结果会保存回当前笔记，方便继续问答、后台查看和本地导出。

导出时只带这些内容：

- 标题
- 来源链接
- 标签
- AI 结构化分析结果

不会导出原始正文，因为很多从网页抓下来的正文仍然比较杂，需要额外清理。

批量导出时，每篇笔记都会生成一个独立文件夹，内部包含：

- `note.md`
- `note.json`
- `note.html`

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

## 当前产品形态

现在的 AI Notes 已经不是单纯“存一篇文章，然后让 AI 总结”的 Demo 了，而是一个有基本知识工作流的本地化产品：

1. 收藏文章
2. 加标签
3. 做 AI 分析
4. 继续问答
5. 切换生命周期状态
6. 按条件筛选和回看
7. 把相关笔记加入临时资料集
8. 导出有价值的 AI 结果

这也是它后面继续往“个人知识库”方向演进的基础。

## 后续可继续扩展

推荐优先级：

1. 项目稳定性修复与依赖版本收口
2. 更强的文章导入与清洗能力
3. 基于临时资料集的 AI 问答
4. 保存型资料集与知识主题管理
5. 部署上线

## 学习价值

这个项目很适合用来理解这些全栈 AI 开发概念：

- 前端页面如何和数据库交互
- 为什么模型密钥必须放在服务端
- Supabase 认证和业务用户资料之间是什么关系
- RLS 如何限制用户只能访问自己的数据
- 管理员权限如何落到真实接口里
- AI 输出如何结构化并回写数据库
- 浏览器级抓取为什么能解决部分动态站点导入问题
- 本地导出能力如何在前端完成闭环
- 一个知识类产品如何逐步长出“工作流层”
- 如何先用前端状态做临时资料集，再为后续多篇 AI 问答铺路

## 注意事项

- `.env.local` 不要提交到 GitHub
- 如果你在聊天里暴露过 DeepSeek Key，建议去 DeepSeek 后台重新生成新的 Key
- 浏览器级导入兜底依赖本机可用的 Chrome / Edge
- 如果 URL 导入碰到动态页面，首次抓取成功率可能与目标站点前端结构有关

## 仓库

当前项目仓库：

`git@github.com:palmer67/ai-note.git`

本项目用于学习全栈 AI 应用开发，也适合作为一个持续打磨的个人 AI 产品实验田。
