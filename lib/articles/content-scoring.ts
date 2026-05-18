export interface ExtractionCandidate {
  source: "readability" | "jsonld" | "selector" | "structured" | "fallback";
  content: string;
  extractionMode: "article" | "fallback";
  score: number;
}

export function countMeaningfulBlocks(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 20).length;
}

export function scoreCandidateContent(content: string) {
  const blockCount = countMeaningfulBlocks(content);
  const headingCount = (content.match(/^## /gm) ?? []).length;

  // 更偏向“有段落结构、像文章正文”的内容，而不是单纯字符最多的片段。
  return content.length + blockCount * 90 + headingCount * 60;
}

export function buildCandidate(
  source: ExtractionCandidate["source"],
  rawContent: string,
  extractionMode: ExtractionCandidate["extractionMode"],
  normalizeBlockText: (value: string) => string
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
