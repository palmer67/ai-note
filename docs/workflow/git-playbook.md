# AI Notes Git 约定

这份文档专门记录 `AI Notes` 项目的 Git 使用规则，避免每轮开发时重复决定命名、提交和收口方式。

## 分支命名

统一使用：

```text
codex/<type>-<topic>
```

### 推荐前缀

- `feat`：功能
- `fix`：缺陷修复
- `refactor`：结构收口
- `test`：测试建设
- `docs`：文档

### 示例

- `codex/feat-collection-qa`
- `codex/fix-right-panel-dynamic-stack`
- `codex/refactor-notes-workspace`
- `codex/test-api-route-tests`
- `codex/docs-workflow-skill`

## 提交信息

统一采用 Conventional Commit：

```text
feat: add collection qa
fix: improve workspace default layout
refactor: split article import pipeline
test: add component integration tests
docs: add architecture and testing guides
```

要求：

- 用英文前缀
- 主题短且具体
- 一次 commit 只描述一个主题

## 推送前检查

最少执行：

```bash
git status
npm run lint
node_modules\.bin\tsc.cmd --noEmit
npm run test:run
npm run build
```

如果某一项失败，先修，不带病推送。

## PR 规则

每次推送后必须准备：

- PR 链接
- PR 标题
- 中文说明
- English Summary
- Verification

### PR 描述模板

```markdown
## 中文说明
- 改了什么
- 为什么改
- 影响范围

## English Summary
- What changed
- Why it changed
- Scope

## Verification
- npm run lint
- node_modules\.bin\tsc.cmd --noEmit
- npm run test:run
- npm run build
```

## 收口规则

只有确认 PR 已合并后才允许收口。

标准步骤：

```bash
git checkout main
git pull --rebase origin main
git branch -d <branch-name>
git push origin --delete <branch-name>
```

### 收口前必须确认

- 当前分支内容已经进入 `main`
- 本地工作区干净
- 不存在未合并却要删分支的情况

## 噪声文件处理

以下文件如果只是自动生成差异，默认不要提交：

- `next-env.d.ts`
- `.next/types/*`

处理方式：

```bash
git restore next-env.d.ts
```

## 不要做的事

- 不在 `main` 上直接做功能开发
- 不把多个主题混进一个 PR
- 不在未确认合并时提前删分支
- 不提交 `.env.local`
- 不为了省事跳过验证
