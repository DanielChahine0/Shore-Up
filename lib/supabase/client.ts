import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null until Supabase is configured. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  client ??= createBrowserClient(url, anonKey);
  return client;
}
