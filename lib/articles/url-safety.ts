import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0"
]);

const MAX_REDIRECTS = 5;

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

export async function assertSafeRemoteUrl(input: string) {
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

export async function fetchHtmlWithSafeRedirects(initialUrl: string) {
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
