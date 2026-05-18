import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { isIP } from "node:net";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { chromium } from "playwright-core";

interface ImportedArticle {
  title: string;
  sourceUrl: string;
  content: string;
  extractionMode: "article" | "fallback";
}

interface ExtractionCandidate {
  source: "readability" | "jsonld" | "selector" | "structured" | "fallback";
  content: string;
  extractionMode: ImportedArticle["extractionMode"];
  score: number;
}

interface JsonLdArticleData {
  title: string;
  articleBody: string;
  description: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0"
]);

const STOP_PATTERNS = [
  "全部评论",
  "我来说一句",
  "发表评论",
  "扫码分享",
  "关联阅读",
  "App 内打开",
  "下载 App",
  "用户协议",
  "联系我们"
];

const CONTENT_ROOT_SELECTORS = [
  "article",
  "main article",
  "main",
  "[itemprop='articleBody']",
  ".article-content",
  ".article__content",
  ".post-content",
  ".post-body",
  ".entry-content",
  ".entry-body",
  ".markdown-body",
  ".rich-text",
  ".content-article",
  ".content__article",
  ".story-body",
  ".article-body"
];

const COMMON_BROWSER_PATHS = [
  process.env.BROWSER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium"
].filter(Boolean) as string[];

const MAX_REDIRECTS = 5;
const RENDERED_IMPORT_TIMEOUT_MS = 35_000;

let renderedImportActive = false;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function collapseInlineWhitespace(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function cleanText(value: string) {
  return collapseInlineWhitespace(value.replace(/<[^>]+>/g, " "));
}

function normalizeBlockText(value: string) {
  const lines = decodeHtmlEntities(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .map((line) => line.replace(/\s+/g, " "))
    .filter(Boolean);

  const dedupedLines: string[] = [];

  for (const line of lines) {
    if (dedupedLines.at(-1) !== line) {
      dedupedLines.push(line);
    }
  }

  return dedupedLines.join("\n\n").trim();
}

function htmlToStructuredText(html: string) {
  return normalizeBlockText(
    html
      .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/blockquote|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<blockquote\b[^>]*>/gi, "\n> ")
      .replace(/<h[1-6]\b[^>]*>/gi, "\n## ")
      .replace(/<[^>]+>/g, " ")
  );
}

function stripDangerousBlocks(html: string) {
  // 保留 JSON-LD，移除会干扰正文提取的脚本和嵌入块，
  // 避免后续选择器和文本归一化吃进大量噪声。
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ");
}

function extractMetaContent(html: string, key: string) {
  const metaTagPattern = /<meta\b[^>]*>/gi;
  const tags = html.match(metaTagPattern) ?? [];

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase();

    if (
      !normalizedTag.includes(`property="${key.toLowerCase()}"`) &&
      !normalizedTag.includes(`name="${key.toLowerCase()}"`)
    ) {
      continue;
    }

    const contentMatch = tag.match(/content\s*=\s*("([^"]*)"|'([^']*)')/i);
    const content = contentMatch?.[2] ?? contentMatch?.[3];

    if (content) {
      return cleanText(content);
    }
  }

  return "";
}

function extractTagContent(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);

  return match?.[1] ?? "";
}

function extractTagContents(html: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");

  return [...html.matchAll(pattern)].map((match) => match[1] ?? "").filter(Boolean);
}

function extractStructuredBlocks(html: string) {
  const blockMatches = [...html.matchAll(/<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const blocks: string[] = [];

  for (const match of blockMatches) {
    const tagName = (match[1] ?? "").toLowerCase();
    const text = cleanText(match[2] ?? "");

    if (!text) {
      continue;
    }

    if (tagName.startsWith("h")) {
      if (text.length >= 2 && text.length <= 120) {
        blocks.push(`## ${text}`);
      }
      continue;
    }

    if (tagName === "li") {
      if (text.length >= 6) {
        blocks.push(`- ${text}`);
      }
      continue;
    }

    if (tagName === "blockquote") {
      if (text.length >= 20) {
        blocks.push(`> ${text}`);
      }
      continue;
    }

    if (text.length >= 14) {
      blocks.push(text);
    }
  }

  const dedupedBlocks: string[] = [];

  for (const block of blocks) {
    if (dedupedBlocks.at(-1) !== block) {
      dedupedBlocks.push(block);
    }
  }

  return dedupedBlocks;
}

function trimAfterContentTail(blocks: string[]) {
  const trimmed: string[] = [];

  for (const block of blocks) {
    // 很多站点会在正文后拼评论、下载引导、分享模块，
    // 当前面已经积累了足够正文块时，遇到这些尾部标记就提前截断。
    if (trimmed.length >= 8 && STOP_PATTERNS.some((pattern) => block.includes(pattern))) {
      break;
    }

    trimmed.push(block);
  }

  return trimmed;
}

function chooseBestContentRoot(html: string) {
  const bodyHtml = extractTagContent(html, "body") || html;
  const candidates = [bodyHtml, ...extractTagContents(html, "main"), ...extractTagContents(html, "article")];

  let bestHtml = bodyHtml;
  let bestScore = 0;

  for (const candidate of candidates) {
    const blocks = trimAfterContentTail(extractStructuredBlocks(candidate));
    const score = blocks.join("\n\n").length;

    if (score > bestScore) {
      bestScore = score;
      bestHtml = candidate;
    }
  }

  return bestHtml;
}

function extractReadableBody(html: string) {
  return normalizeBlockText(
    html
      .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n\n")
    .filter((line) => line.length >= 16)
    .slice(0, 120)
    .join("\n\n");
}

function countMeaningfulBlocks(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 20).length;
}

function scoreCandidateContent(content: string) {
  const blockCount = countMeaningfulBlocks(content);
  const headingCount = (content.match(/^## /gm) ?? []).length;

  // 更偏向“有段落结构、像文章正文”的内容，而不是单纯字符最多的片段。
  return content.length + blockCount * 90 + headingCount * 60;
}

function buildCandidate(
  source: ExtractionCandidate["source"],
  rawContent: string,
  extractionMode: ImportedArticle["extractionMode"]
) {
  const content = normalizeBlockText(rawContent);

  if (!content) {
    return null;
  }

  return {
    source,
    content,
    extractionMode,
    score: scoreCandidateContent(content)
  } satisfies ExtractionCandidate;
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function isPrivateAddress(address: string) {
  const type = isIP(address);

  if (type === 4) {
    return isPrivateIpv4(address);
  }

  if (type === 6) {
    return isPrivateIpv6(address);
  }

  return false;
}

function flattenJsonLdNodes(input: unknown): Record<string, unknown>[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenJsonLdNodes(item));
  }

  if (typeof input !== "object") {
    return [];
  }

  const node = input as Record<string, unknown>;
  const graph = node["@graph"];

  // JSON-LD 既可能是单对象，也可能挂在 @graph 里，这里统一摊平成节点数组。
  return [node, ...flattenJsonLdNodes(graph)];
}

function matchesArticleType(node: Record<string, unknown>) {
  const rawType = node["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];

  return types.some((type) => {
    if (typeof type !== "string") {
      return false;
    }

    return ["article", "newsarticle", "blogposting", "report", "techarticle"].includes(type.toLowerCase());
  });
}

function extractJsonLdArticleData(html: string): JsonLdArticleData {
  const scriptMatches = [
    ...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ];

  let bestArticleBody = "";
  let bestTitle = "";
  let bestDescription = "";

  for (const match of scriptMatches) {
    const rawJson = (match[1] ?? "").trim();

    if (!rawJson) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const nodes = flattenJsonLdNodes(parsed);

      for (const node of nodes) {
        if (!matchesArticleType(node)) {
          continue;
        }

        // 同一个页面可能有多个 Article 节点，这里优先保留正文最长的那份。
        const articleBody = typeof node.articleBody === "string" ? normalizeBlockText(node.articleBody) : "";
        const title =
          typeof node.headline === "string"
            ? collapseInlineWhitespace(node.headline)
            : typeof node.name === "string"
              ? collapseInlineWhitespace(node.name)
              : "";
        const description = typeof node.description === "string" ? normalizeBlockText(node.description) : "";

        if (articleBody.length > bestArticleBody.length) {
          bestArticleBody = articleBody;
        }

        if (!bestTitle && title) {
          bestTitle = title;
        }

        if (description.length > bestDescription.length) {
          bestDescription = description;
        }
      }
    } catch {
      continue;
    }
  }

  return {
    title: bestTitle,
    articleBody: bestArticleBody,
    description: bestDescription
  };
}

function extractReadabilityCandidate(html: string, url: string) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return { title: "", content: "" };
    }

    return {
      title: collapseInlineWhitespace(article.title ?? ""),
      content: htmlToStructuredText(article.content ?? "")
    };
  } catch {
    return { title: "", content: "" };
  }
}

function extractSelectorCandidate(html: string, url: string) {
  try {
    const dom = new JSDOM(html, { url });
    const { document } = dom.window;
    let bestContent = "";

    for (const selector of CONTENT_ROOT_SELECTORS) {
      const nodes = [...document.querySelectorAll(selector)];

      for (const node of nodes) {
        const candidate = htmlToStructuredText(node.innerHTML);

        if (candidate.length > bestContent.length) {
          bestContent = candidate;
        }
      }
    }

    return bestContent;
  } catch {
    return "";
  }
}

function looksLikeChallengePage(html: string) {
  const normalized = html.toLowerCase();

  return (
    normalized.includes("waf_jschallenge") ||
    normalized.includes("_wafchallengeid") ||
    normalized.includes("window.wafjs") ||
    normalized.includes("please wait") ||
    normalized.includes("captcha")
  );
}

function getBrowserExecutablePath() {
  return COMMON_BROWSER_PATHS.find((path) => existsSync(path)) ?? null;
}

async function closeBrowserQuietly(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  try {
    await browser.close();
  } catch {
    // Browser may already be closed by the timeout guard.
  }
}

async function fetchRenderedHtml(url: string) {
  if (renderedImportActive) {
    throw new Error("增强导入正在处理其他链接，请稍后再试。");
  }

  // 浏览器兜底成本高，而且本地环境里通常只需要串行执行一个导入任务。
  renderedImportActive = true;

  try {
    return await fetchRenderedHtmlUnchecked(url);
  } finally {
    renderedImportActive = false;
  }
}

async function fetchRenderedHtmlUnchecked(url: string) {
  const executablePath = getBrowserExecutablePath();

  if (!executablePath) {
    throw new Error("当前环境没有可用浏览器，无法执行增强导入。");
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  try {
    // Playwright 有时会卡在目标页的前端脚本里，这里用外层定时器兜底关浏览器。
    timeoutId = setTimeout(() => {
      timedOut = true;
      void browser.close();
    }, RENDERED_IMPORT_TIMEOUT_MS);

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000
    });

    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      // Some pages keep long connections open; a settled DOM is enough here.
    }

    try {
      await page.waitForFunction(
        () => {
          const text = document.body?.innerText ?? "";

          // 至少等正文长度达到一个可分析阈值，再认为页面基本稳定。
          return text.length > 800 && !text.includes("Please wait");
        },
        { timeout: 12000 }
      );
    } catch {
      // We'll still inspect whatever DOM is available below.
    }

    return {
      html: await page.content(),
      finalUrl: page.url()
    };
  } catch (error) {
    if (timedOut) {
      throw new Error("增强导入超时，请稍后重试或手动粘贴正文。");
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    await closeBrowserQuietly(browser);
  }
}

function extractArticleFromHtml(rawHtml: string, finalUrl: string): ImportedArticle {
  const html = stripDangerousBlocks(rawHtml);
  const jsonLdData = extractJsonLdArticleData(rawHtml);
  const readabilityData = extractReadabilityCandidate(html, finalUrl);
  const selectorContent = extractSelectorCandidate(html, finalUrl);

  const contentRootHtml = chooseBestContentRoot(html);
  const structuredContent = trimAfterContentTail(extractStructuredBlocks(contentRootHtml)).join("\n\n");
  const fallbackContent =
    extractReadableBody(contentRootHtml) ||
    jsonLdData.description ||
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description");

  const candidates = [
    buildCandidate("readability", readabilityData.content, "article"),
    buildCandidate("jsonld", jsonLdData.articleBody, "article"),
    buildCandidate("selector", selectorContent, "article"),
    buildCandidate("structured", structuredContent, "article"),
    buildCandidate("fallback", fallbackContent, "fallback")
  ].filter((candidate): candidate is ExtractionCandidate => Boolean(candidate));

  // 多策略并行产出候选内容，最后统一按分数选“最像正文”的那份。
  const bestCandidate = [...candidates].sort((left, right) => right.score - left.score)[0];

  if (!bestCandidate || bestCandidate.content.length < 80) {
    throw new Error("自动抓取到的正文太少了，这个网页可能不适合当前导入方式。");
  }

  const title =
    readabilityData.title ||
    jsonLdData.title ||
    extractMetaContent(html, "og:title") ||
    cleanText(extractTagContent(html, "title")) ||
    cleanText(extractTagContent(html, "h1")) ||
    "未命名文章";

  return {
    title,
    sourceUrl: finalUrl,
    content: bestCandidate.content,
    extractionMode: bestCandidate.extractionMode
  };
}

async function assertSafeRemoteUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("链接格式不正确。");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http 或 https 链接。");
  }

  if (url.username || url.password) {
    throw new Error("链接中不能包含用户名或密码。");
  }

  const hostname = url.hostname.toLowerCase();

  // 先挡显式本地地址，再做 DNS 解析，防止通过公网域名跳到私网地址。
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("出于安全原因，不允许抓取本地或内网地址。");
  }

  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error("出于安全原因，不允许抓取本地或内网地址。");
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });

    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
      throw new Error("出于安全原因，不允许抓取本地或内网地址。");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("不允许抓取")) {
      throw error;
    }

    throw new Error("无法解析这个链接，请确认它可以公开访问。");
  }

  return url.toString();
}

async function fetchHtmlWithSafeRedirects(initialUrl: string) {
  let currentUrl = await assertSafeRemoteUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        "User-Agent": "AI Notes Importer/1.0 (+https://github.com/palmer67/ai-note)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(12000)
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("目标网站返回了无效重定向。");
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("重定向次数过多，已停止导入。");
      }

      // 每一次跳转目标都重新做安全校验，避免 SSRF 通过重定向绕过首跳检查。
      currentUrl = await assertSafeRemoteUrl(new URL(location, currentUrl).toString());
      continue;
    }

    return {
      response,
      finalUrl: currentUrl
    };
  }

  throw new Error("重定向次数过多，已停止导入。");
}

export async function importArticleFromUrl(inputUrl: string): Promise<ImportedArticle> {
  const { response, finalUrl } = await fetchHtmlWithSafeRedirects(inputUrl);

  if (!response.ok) {
    throw new Error(`抓取失败，目标网站返回了 ${response.status}。`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error("这个链接返回的不是网页内容，暂时无法导入。");
  }

  const rawHtml = (await response.text()).slice(0, 2_000_000);

  if (!looksLikeChallengePage(rawHtml)) {
    try {
      // 优先走静态提取，只有明显不足时才进入浏览器兜底，降低导入成本。
      return extractArticleFromHtml(rawHtml, finalUrl);
    } catch {
      // Fall through to browser rendering when static extraction still comes up short.
    }
  }

  // 动态页、挑战页或静态提取失败时，回退到浏览器渲染版本再抽正文。
  const rendered = await fetchRenderedHtml(finalUrl);

  return extractArticleFromHtml(rendered.html.slice(0, 2_000_000), rendered.finalUrl);
}
