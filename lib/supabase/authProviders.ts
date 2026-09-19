import "server-only";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/**
 * Whether Google sign-in is switched on in the Supabase project. Offering it while it is off
 * sends people to a raw "provider is not enabled" error on Supabase's domain, so the button
 * only shows once the project says it will work. Any doubt counts as off.
 */
export async function googleSignInEnabled(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLIC_KEY },
      // Turning Google on in the dashboard shows up here within a minute, with no redeploy.
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
