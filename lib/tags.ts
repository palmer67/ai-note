const TAG_SPLIT_PATTERN = /[,，;；、\n]+/;

export function normalizeTag(rawTag: string) {
  // 标签统一转小写并压缩空白，减少 “AI / ai / AI  ” 这类重复值。
  return rawTag.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const tags = value
    .split(TAG_SPLIT_PATTERN)
    .map((tag) => normalizeTag(tag))
    .filter(Boolean);

  return Array.from(new Set(tags));
}

export function serializeTags(tags: string[]) {
  // 数据库存的是单个字符串，因此落库前统一做一次归一化和去重。
  const normalized = tags.map((tag) => normalizeTag(tag)).filter(Boolean);

  return Array.from(new Set(normalized)).join(", ");
}
