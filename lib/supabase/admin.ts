import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses Row Level Security, so it is only used where
 * the server has already checked who is asking (uploads, webhooks).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
