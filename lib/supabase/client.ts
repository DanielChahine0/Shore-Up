import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_KEY as publishableKey, SUPABASE_URL as url } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null until Supabase is configured. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!url || !publishableKey) return null;
  client ??= createBrowserClient(url, publishableKey);
  return client;
}
