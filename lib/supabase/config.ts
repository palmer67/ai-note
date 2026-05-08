export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  return url.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

export function getSupabasePublicKey() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (publishableKey) {
    return publishableKey;
  }

  if (legacyAnonKey) {
    return legacyAnonKey;
  }

  throw new Error(
    "Missing Supabase public key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}
