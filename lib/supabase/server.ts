import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

/** Per-request Supabase client that acts as the signed-in user (RLS applies). */
export async function supabaseServer() {
  if (!url || !anonKey) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes sessions instead.
        }
      },
    },
  });
}
