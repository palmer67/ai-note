import JSZip from "jszip";

import { parseTags } from "@/lib/tags";
import type { ArticleBreakdown, Note } from "@/lib/types";

export type ExportFormat = "markdown" | "json" | "html";

interface ExportableAiAnalysisPayload {
  noteId: string;
  title: string;
  sourceUrl: string | null;
  tags: string[];
  analysis: ArticleBreakdown;
}

interface RenderedExportFile {
  content: string;
  extension: string;
  mimeType: string;
}

export interface ExportedAiAnalysisFile extends RenderedExportFile {
  filename: string;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown",
  json: "JSON",
  html: "HTML"
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeYamlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function slugifyTitle(title: string, fallbackId: string) {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || `note-${fallbackId.slice(0, 8)}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderMarkdownFile(payload: ExportableAiAnalysisPayload) {
  // Markdown 用 frontmatter 承载元信息，方便后续被 Obsidian、静态站点或脚本继续处理。
  const frontmatter = [
    "---",
    `title: "${escapeYamlString(payload.title)}"`,
    `source: "${escapeYamlString(payload.sourceUrl ?? "")}"`,
    ...(payload.tags.length
      ? ["tags:", ...payload.tags.map((tag) => `  - "${escapeYamlString(tag)}"`)]
      : ["tags: []"]),
    "---"
  ].join("\n");

  const sections = [
    `# ${payload.title}`,
    payload.sourceUrl ? `来源：${payload.sourceUrl}` : "来源：",
    payload.tags.length ? `标签：${payload.tags.join(", ")}` : "标签：",
    "",
    "## 主题",
    payload.analysis.topic,
    "",
    "## 核心观点",
    payload.analysis.coreArgument,
    "",
    "## 关键论据",
    ...(payload.analysis.supportingEvidence.length
      ? payload.analysis.supportingEvidence.map((item) => `- ${item}`)
      : ["- 无"]),
    "",
    "## 适用场景",
    ...(payload.analysis.bestFitScenarios.length
      ? payload.analysis.bestFitScenarios.map((item) => `- ${item}`)
      : ["- 无"]),
    "",
    "## 我的启发",
    ...(payload.analysis.takeaways.length ? payload.analysis.takeaways.map((item) => `- ${item}`) : ["- 无"])
  ];

  return `${frontmatter}\n\n${sections.join("\n")}`;
}

function renderJsonFile(payload: ExportableAiAnalysisPayload) {
  return JSON.stringify(
    {
      title: payload.title,
      sourceUrl: payload.sourceUrl,
      tags: payload.tags,
      analysis: payload.analysis
    },
    null,
    2
  );
}

function renderListItems(items: string[]) {
  if (!items.length) {
    return "<li>无</li>";
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderHtmlFile(payload: ExportableAiAnalysisPayload) {
  const tagMarkup = payload.tags.length
    ? payload.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")
    : '<span class="tag tag-muted">无标签</span>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(payload.title)} - AI Notes Export</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #f8f2e8;
        --surface: #fffaf3;
        --border: rgba(73, 51, 34, 0.14);
        --ink: #1f1712;
        --ink-soft: #5b4a3f;
        --accent: #a13d2d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 20px;
        font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(161, 61, 45, 0.08), transparent 28%),
          linear-gradient(180deg, #f8f2e8 0%, #efe4d5 100%);
      }
      .sheet {
        width: min(900px, 100%);
        margin: 0 auto;
        padding: 32px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: rgba(255, 250, 243, 0.94);
        box-shadow: 0 24px 60px rgba(61, 43, 30, 0.12);
      }
      h1, h2 { margin: 0; }
      h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 2.2rem;
        line-height: 1.05;
      }
      .meta {
        display: grid;
        gap: 10px;
        margin-top: 18px;
        color: var(--ink-soft);
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(161, 61, 45, 0.18);
        background: rgba(161, 61, 45, 0.08);
        color: var(--accent);
        font-size: 0.88rem;
      }
      .tag-muted {
        color: var(--ink-soft);
        border-color: var(--border);
        background: rgba(255, 255, 255, 0.6);
      }
      section {
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
      }
      h2 {
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      p, li {
        line-height: 1.8;
        font-size: 1rem;
      }
      ul {
        margin: 14px 0 0;
        padding-left: 22px;
      }
      a {
        color: var(--accent);
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <article class="sheet">
      <h1>${escapeHtml(payload.title)}</h1>
      <div class="meta">
        <div>来源：${payload.sourceUrl ? `<a href="${escapeHtml(payload.sourceUrl)}">${escapeHtml(payload.sourceUrl)}</a>` : "无"}</div>
        <div class="tags">${tagMarkup}</div>
      </div>

      <section>
        <h2>主题</h2>
        <p>${escapeHtml(payload.analysis.topic)}</p>
      </section>
      <section>
        <h2>核心观点</h2>
        <p>${escapeHtml(payload.analysis.coreArgument)}</p>
      </section>
      <section>
        <h2>关键论据</h2>
        <ul>${renderListItems(payload.analysis.supportingEvidence)}</ul>
      </section>
      <section>
        <h2>适用场景</h2>
        <ul>${renderListItems(payload.analysis.bestFitScenarios)}</ul>
      </section>
      <section>
        <h2>我的启发</h2>
        <ul>${renderListItems(payload.analysis.takeaways)}</ul>
      </section>
    </article>
  </body>
</html>`;
}

function renderExportFile(payload: ExportableAiAnalysisPayload, format: ExportFormat): RenderedExportFile {
  switch (format) {
    case "markdown":
      return {
        content: renderMarkdownFile(payload),
        extension: "md",
        mimeType: "text/markdown;charset=utf-8"
      };
    case "json":
      return {
        content: renderJsonFile(payload),
        extension: "json",
        mimeType: "application/json;charset=utf-8"
      };
    case "html":
      return {
        content: renderHtmlFile(payload),
        extension: "html",
        mimeType: "text/html;charset=utf-8"
      };
  }
}

function getUniqueFolderName(baseName: string, usedNames: Set<string>) {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  // 批量导出时标题可能重复，这里保证 ZIP 内每篇笔记都有稳定且不冲突的目录名。
  let suffix = 2;

  while (usedNames.has(`${baseName}-${suffix}`)) {
    suffix += 1;
  }

  const nextName = `${baseName}-${suffix}`;
  usedNames.add(nextName);

  return nextName;
}

export function getExportFormatLabel(format: ExportFormat) {
  return FORMAT_LABELS[format];
}

export function canExportAiAnalysis(note: Note) {
  return Boolean(note.ai_summary);
}

export function buildExportableAiAnalysisPayload(note: Note): ExportableAiAnalysisPayload | null {
  if (!note.ai_summary) {
    return null;
  }

  // 导出层统一从 Note 归一化出一个稳定 payload，后续所有格式都从这里生成。
  return {
    noteId: note.id,
    title: note.title,
    sourceUrl: note.source_url,
    tags: parseTags(note.marker),
    analysis: note.ai_summary
  };
}

export function buildSingleAiAnalysisExportFile(note: Note, format: ExportFormat): ExportedAiAnalysisFile {
  const payload = buildExportableAiAnalysisPayload(note);

  if (!payload) {
    throw new Error("当前笔记还没有 AI 分析结果。");
  }

  // 把“渲染导出内容”和“触发浏览器下载”拆开，方便后续单元测试直接校验内容。
  const file = renderExportFile(payload, format);

  return {
    ...file,
    filename: `${slugifyTitle(payload.title, payload.noteId)}-ai-analysis.${file.extension}`
  };
}

export async function downloadSingleAiAnalysisExport(note: Note, format: ExportFormat) {
  const file = buildSingleAiAnalysisExportFile(note, format);

  downloadBlob(file.filename, new Blob([file.content], { type: file.mimeType }));
}

export async function downloadBatchAiAnalysisZip(notes: Note[]) {
  const exportablePayloads = notes
    .map((note) => buildExportableAiAnalysisPayload(note))
    .filter((payload): payload is ExportableAiAnalysisPayload => Boolean(payload));

  if (!exportablePayloads.length) {
    throw new Error("没有可导出的 AI 分析内容。");
  }

  const zip = new JSZip();
  const usedFolderNames = new Set<string>();

  for (const payload of exportablePayloads) {
    const folderName = getUniqueFolderName(slugifyTitle(payload.title, payload.noteId), usedFolderNames);
    const folder = zip.folder(folderName);

    if (!folder) {
      throw new Error("创建导出压缩包失败。");
    }

    folder.file("note.md", renderExportFile(payload, "markdown").content);
    folder.file("note.json", renderExportFile(payload, "json").content);
    folder.file("note.html", renderExportFile(payload, "html").content);
  }

  // 压缩包名称按日期切分，避免同一批导出在本地下载目录里互相覆盖。
  const archiveName = `ai-analysis-export-${new Date().toISOString().slice(0, 10)}.zip`;
  const archiveBlob = await zip.generateAsync({ type: "blob" });

  downloadBlob(archiveName, archiveBlob);
}
