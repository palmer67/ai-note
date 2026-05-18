import { extractArticleFromHtml, looksLikeChallengePage, type ImportedArticle } from "@/lib/articles/html-extraction";
import { fetchRenderedHtml } from "@/lib/articles/rendered-fallback";
import { fetchHtmlWithSafeRedirects } from "@/lib/articles/url-safety";

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
