import "server-only";
import { cache } from "react";
import { getBeach } from "@/lib/beaches";
import type { FeedPost } from "@/lib/communities/queries";
import { postPhotoUrl } from "@/lib/images/urls";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import type { EarnedAchievement } from "./badges";
import type { UserMode } from "./modes";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  area: string;
  avatar_url: string | null;
  mode: UserMode;
  created_at: string;
};

export type OwnProfile = Profile & { is_adult_confirmed: boolean; directory_opt_in: boolean; is_hidden: boolean };

export type ProfileStats = { total_cleanups: number; beaches_cleaned: number; bags_collected: number };

/** Totals from the trash_stats view. All zero when the view is not there yet. */
export type TrashStats = { gamification_unlocked: boolean; total_items: number; session_count: number; verified_items: number; events_attended: number };

const NO_TRASH_STATS: TrashStats = { gamification_unlocked: false, total_items: 0, session_count: 0, verified_items: 0, events_attended: 0 };

/** A cleanup the person registered for, with the organizer's check-in when there is one. */
export type ProfileEvent = { id: string; beachName: string; beachArea: string; startsAt: string; attendeeCount: number; verifiedItems: number | null };

const PUBLIC_COLUMNS = "id, username, display_name, bio, area, avatar_url, mode, created_at";

/** The signed-in user and their own profile row, or null. Cached per request. */
export const getViewer = cache(async (): Promise<OwnProfile | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data as OwnProfile | null;
});

/**
 * A profile as the current viewer may see it: anyone can see public profiles,
 * and owners can always see their own, even when hidden.
 */
export async function getProfileByUsername(username: string): Promise<{ profile: Profile; isOwner: boolean; own: OwnProfile | null } | null> {
  const viewer = await getViewer();
  if (viewer && viewer.username === username) return { profile: viewer, isOwner: true, own: viewer };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("public_profiles").select(PUBLIC_COLUMNS).eq("username", username).maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data ? { profile: data as Profile, isOwner: false, own: null } : null;
}

type FeedRow = {
  id: string;
  community_slug: string;
  community_name: string;
  beach_id: string;
  zone_name: string;
  body: string;
  bags: number;
  created_at: string;
  author_id: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  like_count: number;
  photo_paths: string[];
};

type OverviewRow = { id: string; beach_name: string; beach_area: string; starts_at: string; attendee_count: number };

/**
 * Everything the profile page shows below the header. Pass isOwner so the
 * unlock panel can read the owner's own (private) clean sessions.
 *
 * Anything added by migration 0005 is optional: if the view or table is not
 * there yet the query error is read as "no data" and the page still renders.
 */
export async function getProfileDetails(userId: string, isOwner = false) {
  const supabase = await supabaseServer();
  const viewer = await getViewer();
  const [posts, achievements, memberships, trash, attending, checkins, sessions] = await Promise.all([
    supabase.from("post_feed").select("*").eq("author_id", userId).order("created_at", { ascending: false }),
    supabase.from("user_achievements").select("achievement_key, earned_at").eq("user_id", userId).order("earned_at"),
    supabase.from("community_members").select("joined_at, communities(slug, name, area)").eq("user_id", userId).order("joined_at"),
    supabase.from("trash_stats").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("cleanup_attendees").select("cleanup_id").eq("user_id", userId),
    supabase.from("cleanup_checkins").select("cleanup_id, items_verified").eq("user_id", userId),
    isOwner ? supabase.from("clean_sessions").select("total_items").eq("user_id", userId).order("total_items", { ascending: false }).limit(1) : null,
  ]);
  for (const result of [posts, achievements, memberships]) {
    if (result.error) throw new Error(`Could not load profile details: ${result.error.message}`);
  }

  const rows = (posts.data ?? []) as unknown as FeedRow[];

  // Which of these posts the person looking at the page has liked.
  let liked = new Set<string>();
  if (viewer && rows.length > 0) {
    const likes = await supabase.from("post_likes").select("post_id").eq("user_id", viewer.id).in("post_id", rows.map((r) => r.id));
    if (likes.error) throw new Error(`Could not load likes: ${likes.error.message}`);
    liked = new Set((likes.data ?? []).map((l) => l.post_id as string));
  }

  const feed: FeedPost[] = rows.map((r) => ({
    id: r.id,
    communitySlug: r.community_slug,
    communityName: r.community_name,
    beachId: r.beach_id,
    beachName: getBeach(r.beach_id)?.name ?? r.beach_id,
    zoneName: r.zone_name,
    body: r.body,
    bags: r.bags,
    createdAt: r.created_at,
    author: r.author_username ? { username: r.author_username, displayName: r.author_display_name!, avatarUrl: r.author_avatar_url } : null,
    authorId: r.author_id,
    likeCount: r.like_count,
    likedByViewer: liked.has(r.id),
    photoUrls: r.photo_paths.map(postPhotoUrl),
  }));

  // Cleanup stats come from the posts themselves, so they are right even for a hidden profile viewing itself.
  const stats: ProfileStats = {
    total_cleanups: feed.length,
    beaches_cleaned: new Set(feed.map((p) => p.beachId)).size,
    bags_collected: feed.reduce((sum, p) => sum + p.bags, 0),
  };

  const events = await listRegisteredEvents(
    ((attending.error ? [] : attending.data) ?? []).map((a) => a.cleanup_id as string),
    ((checkins.error ? [] : checkins.data) ?? []) as { cleanup_id: string; items_verified: number }[],
  );

  type MembershipRow = { communities: { slug: string; name: string; area: string } | null };
  return {
    stats,
    posts: feed,
    trash: (trash.error ? null : (trash.data as TrashStats | null)) ?? NO_TRASH_STATS,
    /** The most items the owner has logged in one session, for unlock progress. */
    bestSessionItems: sessions && !sessions.error ? (sessions.data?.[0]?.total_items ?? 0) : 0,
    events,
    achievements: (achievements.data ?? []) as EarnedAchievement[],
    communities: ((memberships.data ?? []) as unknown as MembershipRow[]).flatMap((m) => (m.communities ? [m.communities] : [])),
  };
}

/** The registered cleanups split into what is still to come and what has been. */
async function listRegisteredEvents(cleanupIds: string[], checkins: { cleanup_id: string; items_verified: number }[]) {
  if (cleanupIds.length === 0) return { upcoming: [] as ProfileEvent[], previous: [] as ProfileEvent[] };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("cleanup_overview").select("id, beach_name, beach_area, starts_at, attendee_count").in("id", cleanupIds);
  if (error) return { upcoming: [] as ProfileEvent[], previous: [] as ProfileEvent[] };

  const verified = new Map(checkins.map((c) => [c.cleanup_id, c.items_verified]));
  const events: ProfileEvent[] = ((data ?? []) as OverviewRow[]).map((c) => ({
    id: c.id,
    beachName: c.beach_name,
    beachArea: c.beach_area,
    startsAt: c.starts_at,
    attendeeCount: c.attendee_count,
    verifiedItems: verified.get(c.id) ?? null,
  }));

  const now = Date.now();
  return {
    upcoming: events.filter((e) => new Date(e.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    previous: events.filter((e) => new Date(e.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}
