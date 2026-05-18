# 模块：用户工作台

## 覆盖范围

- `app/dashboard/page.tsx`
- `components/notes/notes-workspace.tsx`
- `components/notes/notes-list.tsx`
- `components/notes/note-editor.tsx`
- `components/notes/ai-analysis-panel.tsx`
- `components/notes/note-collection-panel.tsx`
- `hooks/use-notes-workspace-state.ts`
- `hooks/use-note-mutations.ts`
- `lib/notes/workspace.ts`
- `lib/note-lifecycle.ts`
- `lib/tags.ts`
- `lib/note-ai-status.ts`

## 模块职责

- 加载当前用户的全部笔记。
- 在客户端管理当前选中文章、草稿、搜索、标签筛选、生命周期视图、资料集、批量导出状态。
- 提供笔记的增删改、生命周期切换、URL 导入、AI 分析、单篇问答、批量导出等入口。

## 架构图

```mermaid
flowchart LR
  DashboardPage["app/dashboard/page.tsx<br/>Server Component"] --> FetchNotes["Supabase select notes"]
  FetchNotes --> Workspace["NotesWorkspace<br/>Client Component"]

  Workspace --> StateHook["useNotesWorkspaceState"]
  Workspace --> MutationHook["useNoteMutations"]
  Workspace --> WorkspaceLib["lib/notes/workspace.ts"]

  Workspace --> List["NotesList"]
  Workspace --> Editor["NoteEditor"]
  Workspace --> Collection["NoteCollectionPanel"]
  Workspace --> AI["AiAnalysisPanel"]

  List --> Filters["搜索 / 标签 / 生命周期 / 批量导出 / 临时资料集入口"]
  Editor --> Draft["标题 / 链接 / 标签 / 正文 / 生命周期"]
  Collection --> TempSet["selectedCollectionIds"]
  AI --> QA["AI 分析 / 单篇问答 / 单篇导出"]

  Workspace --> BrowserSupabase["Supabase Browser Client"]
  Workspace --> ApiAnalyze["POST /api/ai/analyze"]
  Workspace --> ApiImport["POST /api/articles/import"]
  AI --> ApiAsk["POST /api/ai/ask-note"]

  BrowserSupabase --> NotesTable["public.notes"]
  ApiAnalyze --> NotesTable
  ApiImport --> Draft
  ApiAsk --> AI
```

## 状态划分

当前工作台状态已经分成两层：

- `useNotesWorkspaceState`
- `useNoteMutations`

其中页面内存状态主要包括：

- 数据状态：`notes`、`selectedId`、`draft`
- 检索状态：`search`、`activeTag`、`activeLifecycleView`
- 批量导出状态：`batchMode`、`selectedExportIds`、`batchFeedback`
- 临时资料集状态：`selectedCollectionIds`

副作用状态主要包括：

- 操作状态：`savePending`、`deletePending`、`analysisPending`、`importPending`
- 页面反馈状态：`feedback`、`analysisError`

## 当前实现评价

- 优点：核心职责已经从一个超大组件中拆出，状态、远程副作用和纯计算边界更清楚。
- 当前残留问题：`NotesWorkspace` 依然承担最终编排责任，后续如果继续加复杂交互，还可以再把 props 组装继续下沉。

## 推荐拆分方向

优先级从高到低：

1. 提取 `useNotesWorkspaceState()`：集中管理筛选、选择、临时资料集和批量导出状态。
2. 提取 `useNoteMutations()`：集中管理保存、删除、状态切换、导入、分析这些副作用。
3. 把纯计算逻辑下沉到 `lib/notes/*`，例如筛选、排序、统计和选择同步。

以上三步已完成第一轮收口。

## 不建议现在做的事

- 现在不需要引入 Zustand、Redux 之类的全局状态库。
- 现在不需要把工作台拆成多页面工作流，当前单页工作台仍然是合理选择。
