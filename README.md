# AI Notes

AI Notes 是一个面向学习场景的全栈 AI 笔记应用。

你可以把在网上看到的优质文章保存下来，补一个轻量标签，然后交给 AI 自动生成结构化拆解结果。这个项目不只是一个展示页面，而是一套真实可运行的产品骨架，适合一边做功能、一边学习全栈 AI 应用开发。

## 当前已完成的能力

### 用户侧

- 邮箱密码注册与登录
- 新建、编辑、删除文章笔记
- 按标题、标签、正文内容搜索
- 支持多标签输入与标签筛选
- 通过 URL 半自动导入文章标题与正文
- URL 导入支持多策略提取：
  - Readability 正文解析
  - JSON-LD 兜底
  - DOM 选择器兜底
  - 浏览器渲染兜底（可处理部分挑战页，例如掘金）
- 对单篇笔记发起 AI 分析
- 基于笔记继续做 AI 问答
- 保存修改时保留已有 AI 分析结果
- 一键复制 AI 分析结果
- 本地导出 AI 分析内容：
  - 单篇导出：Markdown / JSON / HTML
  - 批量导出：ZIP 压缩包

### 管理员侧

- 查看全部用户
- 查看全部笔记
- 查看笔记归属用户、标签、AI 状态和正文预览
- 修改其他用户角色
- 按用户、AI 状态、关键词筛选后台笔记

## 技术栈

- **Next.js 16**
  前端页面和后端路由在同一个项目内，适合学习全栈开发。

- **Supabase**
  提供认证、Postgres 数据库和 RLS（行级权限控制）。

- **DeepSeek API**
  用于文章 AI 分析与问答，当前通过兼容 OpenAI SDK 的方式调用。

- **Readability + JSDOM**
  用于 URL 导入时的正文抽取增强。

- **Playwright Core**
  用于导入部分动态渲染或挑战页站点时的浏览器级兜底抓取。

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
  notes/                      笔记列表、编辑器、AI 结果面板
lib/
  articles/                   URL 导入与正文提取逻辑
  auth.ts                     登录上下文与管理员校验
  exports/                    AI 分析导出逻辑
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

推荐先在 Supabase SQL Editor 里运行：

- [20260508020000_bootstrap_repair.sql](./supabase/migrations/20260508020000_bootstrap_repair.sql)
- [20260508030000_atomic_role_update.sql](./supabase/migrations/20260508030000_atomic_role_update.sql)

它们会完成这些事情：

- 创建 `profiles` 表
- 创建 `notes` 表
- 创建更新时间触发器
- 创建管理员判断函数
- 开启并配置 RLS
- 配置“新注册用户自动创建 profile”
- 配置管理员角色原子更新，避免并发情况下把最后一个管理员降级

如果改完表结构后页面仍提示 `schema cache` 相关错误，可以在 SQL Editor 执行：

```sql
NOTIFY pgrst, 'reload schema';
```

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

重新登录后，顶部导航会出现 `管理后台`。

## 数据库数据在哪里看

### 登录账号

`Authentication -> Users`

这里看的是谁能登录系统。

### 用户资料与角色

`Table Editor -> public.profiles`

这里看的是业务里的用户资料，例如：

- 邮箱
- 角色
- 创建时间

### 笔记与 AI 结果

`Table Editor -> public.notes`

这里看的是：

- 笔记标题
- 标签
- 正文
- AI 分析结果
- AI 状态

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

不会导出原始正文，因为很多从网页抓下来的正文需要额外清理。

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

1. 多格式导出继续增强
2. 多篇笔记联合检索
3. 基于笔记集的 AI 问答
4. 部署上线
5. 更完整的剪藏与清洗能力

## 学习价值

这个项目适合用来理解这些全栈 AI 开发概念：

- 前端页面如何与数据库交互
- 为什么模型密钥必须放在服务端
- Supabase 认证和业务用户资料的关系
- RLS 如何限制用户只能访问自己的数据
- 管理员权限如何落到真实接口里
- AI 输出如何结构化并回写数据库
- 浏览器级抓取为什么能解决部分动态站点导入问题
- 导出能力如何基于前端本地文件生成完成闭环

## 注意事项

- `.env.local` 不要提交到 GitHub
- 如果你在聊天里暴露过 DeepSeek key，建议去 DeepSeek 后台重新生成新 key
- 浏览器级导入兜底依赖本机可用的 Chrome / Edge

## 仓库

当前项目仓库：

`git@github.com:palmer67/ai-note.git`

本项目用于学习全栈 AI 应用开发。
