import "server-only";
import { getBeach } from "@/lib/beaches";
import type { UserMode } from "@/lib/profiles/modes";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

export type CleanupSummary = {
  id: string;
  beachId: string;
  beachName: string;
  startsAt: string;
  /** Null when the organizer's profile is not public. */
  organizerName: string | null;
  attendeeCount: number;
};

type CleanupRow = { id: string; beach_id: string; organizer_id: string; starts_at: string; cleanup_attendees: { count: number }[] };

async function organizerNames(ids: string[]): Promise<Map<string, { username: string; display_name: string; mode: UserMode; avatar_url: string | null }>> {
  if (ids.length === 0) return new Map();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("public_profiles").select("id, username, display_name, mode, avatar_url").in("id", ids);
  if (error) throw new Error(`Could not load organizers: ${error.message}`);
  return new Map((data ?? []).map((p) => [p.id as string, p as { username: string; display_name: string; mode: UserMode; avatar_url: string | null }]));
}

/** Upcoming cleanups, soonest first. Pass a beach to limit to it. */
export async function listUpcomingCleanups(beachId?: string, limit = 5): Promise<CleanupSummary[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await supabaseServer();
  let query = supabase
    .from("cleanups")
    .select("id, beach_id, organizer_id, starts_at, cleanup_attendees(count)")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);
  if (beachId) query = query.eq("beach_id", beachId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load cleanups: ${error.message}`);

  const rows = (data ?? []) as unknown as CleanupRow[];
  const organizers = await organizerNames([...new Set(rows.map((r) => r.organizer_id))]);
  return rows.map((r) => ({
    id: r.id,
    beachId: r.beach_id,
    beachName: getBeach(r.beach_id)?.name ?? r.beach_id,
    startsAt: r.starts_at,
    organizerName: organizers.get(r.organizer_id)?.display_name ?? null,
    attendeeCount: r.cleanup_attendees[0]?.count ?? 0,
  }));
}

export type CheckInEntry = {
  userId: string;
  /** Null when the volunteer's profile is not public. They still get checked in, just without a name. */
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  checkedIn: boolean;
  itemsVerified: number;
};

export type CheckInBoard = { roster: CheckInEntry[]; checkedIn: number; itemsVerified: number };

/** PostgREST when the table is not in the schema cache, and Postgres when the relation is missing. */
function isMissingTable(error: { code?: string | null }): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

/**
 * Everyone registered for a cleanup and what the organizer has ticked off. The
 * roster comes from cleanup_attendees so private volunteers are in it too; names
 * are left-joined from the public view in code.
 */
export async function getCheckInBoard(cleanupId: string): Promise<CheckInBoard> {
  if (!supabaseConfigured()) return { roster: [], checkedIn: 0, itemsVerified: 0 };
  const supabase = await supabaseServer();
  const [attendees, profiles, checkins] = await Promise.all([
    supabase.from("cleanup_attendees").select("user_id, joined_at").eq("cleanup_id", cleanupId).order("joined_at"),
    supabase.from("cleanup_attendee_profiles").select("user_id, username, display_name, avatar_url").eq("cleanup_id", cleanupId),
    supabase.from("cleanup_checkins").select("user_id, items_verified").eq("cleanup_id", cleanupId),
  ]);
  if (attendees.error) throw new Error(`Could not load who is registered: ${attendees.error.message}`);
  if (profiles.error) throw new Error(`Could not load attendee names: ${profiles.error.message}`);
  // Check-ins arrive with migration 0005. Until it is applied, nobody has been checked in.
  if (checkins.error && !isMissingTable(checkins.error)) throw new Error(`Could not load check-ins: ${checkins.error.message}`);

  const named = new Map((profiles.data ?? []).map((p) => [p.user_id as string, p]));
  const ticked = new Map((checkins.data ?? []).map((c) => [c.user_id as string, c.items_verified as number]));

  const roster: CheckInEntry[] = (attendees.data ?? []).map((a) => {
    const profile = named.get(a.user_id);
    return {
      userId: a.user_id,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      checkedIn: ticked.has(a.user_id),
      itemsVerified: ticked.get(a.user_id) ?? 0,
    };
  });

  return {
    roster,
    checkedIn: ticked.size,
    itemsVerified: [...ticked.values()].reduce((sum, items) => sum + items, 0),
  };
}

export type CleanupDetail = {
  id: string;
  beachId: string;
  beachName: string;
  beachArea: string;
  zoneName: string | null;
  startsAt: string;
  notes: string;
  isUpcoming: boolean;
  organizer: { username: string; displayName: string; mode: UserMode; avatarUrl: string | null } | null;
  organizerId: string;
  attendees: { userId: string; username: string; displayName: string; avatarUrl: string | null; area: string }[];
  /** Everyone going, including people whose profiles are not public. */
  attendeeCount: number;
};

export async function getCleanup(id: string): Promise<CleanupDetail | null> {
  if (!supabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await supabaseServer();
  const [cleanup, attendees] = await Promise.all([
    supabase.from("cleanups").select("id, beach_id, organizer_id, starts_at, notes, zones(name), cleanup_attendees(count)").eq("id", id).maybeSingle(),
    supabase.from("cleanup_attendee_profiles").select("user_id, username, display_name, avatar_url, area").eq("cleanup_id", id).order("joined_at"),
  ]);
  if (cleanup.error) throw new Error(`Could not load cleanup: ${cleanup.error.message}`);
  if (attendees.error) throw new Error(`Could not load attendees: ${attendees.error.message}`);
  if (!cleanup.data) return null;

  const row = cleanup.data as unknown as CleanupRow & { notes: string; zones: { name: string } | null };
  const organizer = (await organizerNames([row.organizer_id])).get(row.organizer_id);
  const beach = getBeach(row.beach_id);
  return {
    id: row.id,
    beachId: row.beach_id,
    beachName: beach?.name ?? row.beach_id,
    beachArea: beach ? `${beach.area}, ${beach.country}` : "",
    zoneName: row.zones?.name ?? null,
    startsAt: row.starts_at,
    notes: row.notes,
    isUpcoming: new Date(row.starts_at) > new Date(),
    organizer: organizer ? { username: organizer.username, displayName: organizer.display_name, mode: organizer.mode, avatarUrl: organizer.avatar_url } : null,
    organizerId: row.organizer_id,
    attendees: (attendees.data ?? []).map((a) => ({ userId: a.user_id, username: a.username, displayName: a.display_name, avatarUrl: a.avatar_url, area: a.area })),
    attendeeCount: row.cleanup_attendees[0]?.count ?? 0,
  };
}
