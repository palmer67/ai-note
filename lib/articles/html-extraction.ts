import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import { buildCandidate, type ExtractionCandidate } from "@/lib/articles/content-scoring";

export interface ImportedArticle {
  title: string;
  sourceUrl: string;
  content: string;
  extractionMode: "article" | "fallback";
}

interface JsonLdArticleData {
  title: string;
  articleBody: string;
  description: string;
}

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

export function normalizeBlockText(value: string) {
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

export function looksLikeChallengePage(html: string) {
  const normalized = html.toLowerCase();

  return (
    normalized.includes("waf_jschallenge") ||
    normalized.includes("_wafchallengeid") ||
    normalized.includes("window.wafjs") ||
    normalized.includes("please wait") ||
    normalized.includes("captcha")
  );
}

export function extractArticleFromHtml(rawHtml: string, finalUrl: string): ImportedArticle {
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
    buildCandidate("readability", readabilityData.content, "article", normalizeBlockText),
    buildCandidate("jsonld", jsonLdData.articleBody, "article", normalizeBlockText),
    buildCandidate("selector", selectorContent, "article", normalizeBlockText),
    buildCandidate("structured", structuredContent, "article", normalizeBlockText),
    buildCandidate("fallback", fallbackContent, "fallback", normalizeBlockText)
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
