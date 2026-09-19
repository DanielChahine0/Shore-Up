import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Lands here after Google sign-in or an email confirmation link. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only ever redirect within this site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/signin?error=link`);
}
