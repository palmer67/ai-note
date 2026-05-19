import { describe, expect, it } from "vitest";

import { isSavedCollectionsSchemaMissingError } from "@/lib/notes/saved-collections";

describe("isSavedCollectionsSchemaMissingError", () => {
  it("returns true for missing relation postgres errors", () => {
    expect(
      isSavedCollectionsSchemaMissingError({
        code: "42P01",
        message: 'relation "public.note_collections" does not exist'
      })
    ).toBe(true);
  });

  it("returns true for schema cache errors", () => {
    expect(
      isSavedCollectionsSchemaMissingError({
        code: "PGRST205",
        message: "Could not find the table 'public.note_collection_items' in the schema cache"
      })
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(
      isSavedCollectionsSchemaMissingError({
        code: "42501",
        message: "new row violates row-level security policy"
      })
    ).toBe(false);
  });
});
