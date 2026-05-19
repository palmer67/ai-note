interface PostgrestLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

function normalizeErrorText(error: PostgrestLikeError | null | undefined) {
  return [error?.message, error?.details, error?.hint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function isSavedCollectionsSchemaMissingError(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return false;
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return true;
  }

  const text = normalizeErrorText(error);

  return (
    text.includes("note_collections") ||
    text.includes("note_collection_items") ||
    text.includes("schema cache") ||
    text.includes("could not find the table")
  );
}
