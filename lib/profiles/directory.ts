import "server-only";
import { listBeaches } from "@/lib/beaches";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import type { UserMode } from "./modes";

export type DirectoryEntry = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  area: string;
  mode: Exclude<UserMode, "break">;
  nextCleanup: { id: string; beachId: string; beachName: string; startsAt: string; isOrganizer: boolean } | null;
  /**
   * A coarse reference point for "near me": the beach of their next cleanup, or
   * a beach in their stated area. Never the person's own location, which we do not have.
   */
  near: { lat: number; lng: number } | null;
};

/** Everyone who opted in to the directory, with their next planned cleanup. */
export async function listDirectory(): Promise<DirectoryEntry[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await supabaseServer();
  const people = await supabase
    .from("public_profiles")
    .select("id, username, display_name, avatar_url, area, mode")
    .eq("directory_opt_in", true)
    .neq("mode", "break")
    .order("display_name");
  if (people.error) throw new Error(`Could not load the directory: ${people.error.message}`);

  const ids = (people.data ?? []).map((p) => p.id as string);
  const attending =
    ids.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("cleanup_attendees")
          .select("user_id, cleanups!inner(id, beach_id, organizer_id, starts_at)")
          .in("user_id", ids)
          .gt("cleanups.starts_at", new Date().toISOString());
  if (attending.error) throw new Error(`Could not load planned cleanups: ${attending.error.message}`);

  type AttendingRow = { user_id: string; cleanups: { id: string; beach_id: string; organizer_id: string; starts_at: string } };
  const nextByUser = new Map<string, AttendingRow["cleanups"]>();
  for (const row of (attending.data ?? []) as unknown as AttendingRow[]) {
    // A cleanup they host beats one they are attending; otherwise the soonest wins.
    const current = nextByUser.get(row.user_id);
    const hosts = row.cleanups.organizer_id === row.user_id;
    const currentHosts = current?.organizer_id === row.user_id;
    if (!current || (hosts && !currentHosts) || (hosts === currentHosts && row.cleanups.starts_at < current.starts_at)) {
      nextByUser.set(row.user_id, row.cleanups);
    }
  }

  const beaches = listBeaches();
  const beachById = new Map(beaches.map((b) => [b.id, b]));
  return (people.data ?? []).map((p) => {
    const next = nextByUser.get(p.id);
    const nextBeach = next ? beachById.get(next.beach_id) : undefined;
    const areaBeach = beaches.find((b) => p.area && p.area.toLowerCase().includes(b.area.toLowerCase()));
    const ref = nextBeach ?? areaBeach;
    return {
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      area: p.area,
      mode: p.mode,
      nextCleanup: next ? { id: next.id, beachId: next.beach_id, beachName: nextBeach?.name ?? next.beach_id, startsAt: next.starts_at, isOrganizer: next.organizer_id === p.id } : null,
      near: ref ? { lat: ref.lat, lng: ref.lng } : null,
    };
  });
}
