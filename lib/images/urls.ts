import { SUPABASE_URL } from "@/lib/supabase/env";

/** Public URL for a stored post photo path. */
export function postPhotoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/post-photos/${path}`;
}
