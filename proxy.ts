import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Refreshes the Supabase session cookie so Server Components always see a valid user. */
export async function proxy(request: NextRequest) {
  const url = SUPABASE_URL;
  const publishableKey = SUPABASE_PUBLIC_KEY;
  let response = NextResponse.next({ request });
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Pages only. Static assets, images, and the public beach API carry no session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/beaches|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
