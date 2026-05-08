const TAG_SPLIT_PATTERN = /[,，;；\n]+/;

export function normalizeTag(rawTag: string) {
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
  const normalized = tags.map((tag) => normalizeTag(tag)).filter(Boolean);

  return Array.from(new Set(normalized)).join(", ");
}
