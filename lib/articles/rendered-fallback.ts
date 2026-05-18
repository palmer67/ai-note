import { existsSync } from "node:fs";

import { chromium } from "playwright-core";

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

const RENDERED_IMPORT_TIMEOUT_MS = 35_000;

let renderedImportActive = false;

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

export async function fetchRenderedHtml(url: string) {
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
