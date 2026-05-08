import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

interface ImportedArticle {
  title: string;
  sourceUrl: string;
  content: string;
  extractionMode: "article" | "fallback";
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

const MAX_REDIRECTS = 5;

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

function cleanText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDangerousBlocks(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ")
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
      if (text.length >= 2 && text.length <= 80) {
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

    if (text.length >= 20) {
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
  return html
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => cleanText(line))
    .filter((line) => line.length >= 16)
    .slice(0, 120)
    .join("\n\n");
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
  const html = stripDangerousBlocks(rawHtml);

  const title =
    extractMetaContent(html, "og:title") ||
    cleanText(extractTagContent(html, "title")) ||
    cleanText(extractTagContent(html, "h1")) ||
    "未命名文章";

  const contentRootHtml = chooseBestContentRoot(html);
  const contentBlocks = trimAfterContentTail(extractStructuredBlocks(contentRootHtml));

  let content = contentBlocks.join("\n\n");
  let extractionMode: ImportedArticle["extractionMode"] = "article";

  if (content.length < 280) {
    extractionMode = "fallback";
    content =
      extractReadableBody(contentRootHtml) ||
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description");
  }

  if (!content || content.length < 80) {
    throw new Error("自动抓取到的正文太少了，这个网页可能不适合当前导入方式。");
  }

  return {
    title,
    sourceUrl: finalUrl,
    content,
    extractionMode
  };
}
