import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie so Server Components always see a valid user. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
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
