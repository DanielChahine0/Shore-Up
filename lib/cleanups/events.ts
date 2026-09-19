import "server-only";
import { getBeach } from "@/lib/beaches";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import type { EventAttendee, EventItem } from "./rank";

/** Enough events that the browser has something to rank, few enough to stay one quick request. */
const EVENT_LIMIT = 50;
const AVATARS_PER_CARD = 5;

type OverviewRow = {
  id: string;
  beach_id: string;
  beach_name: string;
  beach_area: string;
  beach_lat: number;
  beach_lng: number;
  starts_at: string;
  organizer_display_name: string | null;
  attendee_count: number;
};

type AttendeeRow = { cleanup_id: string; user_id: string; display_name: string; avatar_url: string | null };

/**
 * Every upcoming public cleanup, with the first few public attendees and whether
 * the viewer is registered. No location is taken or returned: the events menu
 * ranks these against the place kept in the visitor's own browser.
 */
export async function listUpcomingEvents(): Promise<EventItem[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await supabaseServer();

  const [overview, auth] = await Promise.all([
    supabase
      .from("cleanup_overview")
      .select("id, beach_id, beach_name, beach_area, beach_lat, beach_lng, starts_at, organizer_display_name, attendee_count")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(EVENT_LIMIT),
    supabase.auth.getUser(),
  ]);
  if (overview.error) throw new Error(`Could not load events: ${overview.error.message}`);

  const rows = (overview.data ?? []) as OverviewRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const viewerId = auth.data.user?.id ?? null;

  const [attendees, mine] = await Promise.all([
    supabase.from("cleanup_attendee_profiles").select("cleanup_id, user_id, display_name, avatar_url").in("cleanup_id", ids).order("joined_at"),
    viewerId
      ? supabase.from("cleanup_attendees").select("cleanup_id").in("cleanup_id", ids).eq("user_id", viewerId)
      : Promise.resolve({ data: [] as { cleanup_id: string }[], error: null }),
  ]);
  if (attendees.error) throw new Error(`Could not load who is going: ${attendees.error.message}`);
  if (mine.error) throw new Error(`Could not load your cleanups: ${mine.error.message}`);

  const faces = new Map<string, EventAttendee[]>();
  for (const row of (attendees.data ?? []) as AttendeeRow[]) {
    const shown = faces.get(row.cleanup_id) ?? [];
    if (shown.length < AVATARS_PER_CARD) shown.push({ userId: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url });
    faces.set(row.cleanup_id, shown);
  }
  const registered = new Set((mine.data ?? []).map((row) => row.cleanup_id));

  return rows.map((row) => {
    // The local beach file is the source the rest of the map uses, so names and pins agree.
    const beach = getBeach(row.beach_id);
    return {
      id: row.id,
      beachId: row.beach_id,
      beachName: beach?.name ?? row.beach_name,
      beachArea: beach ? `${beach.area}, ${beach.country}` : row.beach_area,
      lat: beach?.lat ?? row.beach_lat,
      lng: beach?.lng ?? row.beach_lng,
      startsAt: row.starts_at,
      organizerName: row.organizer_display_name,
      attendeeCount: row.attendee_count,
      attendees: faces.get(row.id) ?? [],
      registered: registered.has(row.id),
    };
  });
}
