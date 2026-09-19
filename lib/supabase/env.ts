/**
 * Supabase's public settings. The browser-safe key goes by two names: the newer
 * "publishable" key and the legacy "anon" key. Either works.
 * Each variable is read by its full literal name so Next.js can inline it for the browser.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
