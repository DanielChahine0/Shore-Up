import "server-only";
import { cache } from "react";
import { getBeach } from "@/lib/beaches";
import type { AchievementKey } from "@/lib/achievements/config";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
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

export type CleanupHistoryItem = { id: string; beachId: string; beachName: string; zoneName: string; bags: number; createdAt: string };

export async function getProfileDetails(userId: string) {
  const supabase = await supabaseServer();
  const [posts, achievements, memberships] = await Promise.all([
    supabase.from("posts").select("id, beach_id, bags, created_at, zones(name)").eq("author_id", userId).order("created_at", { ascending: false }),
    supabase.from("user_achievements").select("achievement_key, earned_at").eq("user_id", userId).order("earned_at"),
    supabase.from("community_members").select("joined_at, communities(slug, name, area)").eq("user_id", userId).order("joined_at"),
  ]);
  for (const result of [posts, achievements, memberships]) {
    if (result.error) throw new Error(`Could not load profile details: ${result.error.message}`);
  }

  type PostRow = { id: string; beach_id: string; bags: number; created_at: string; zones: { name: string } | null };
  const history: CleanupHistoryItem[] = ((posts.data ?? []) as unknown as PostRow[]).map((p) => ({
    id: p.id,
    beachId: p.beach_id,
    beachName: getBeach(p.beach_id)?.name ?? p.beach_id,
    zoneName: p.zones?.name ?? "",
    bags: p.bags,
    createdAt: p.created_at,
  }));

  // Stats come from the posts themselves, so they are right even for a hidden profile viewing itself.
  const stats: ProfileStats = {
    total_cleanups: history.length,
    beaches_cleaned: new Set(history.map((h) => h.beachId)).size,
    bags_collected: history.reduce((sum, h) => sum + h.bags, 0),
  };

  type MembershipRow = { communities: { slug: string; name: string; area: string } | null };
  return {
    stats,
    history,
    achievements: (achievements.data ?? []) as { achievement_key: AchievementKey; earned_at: string }[],
    communities: ((memberships.data ?? []) as unknown as MembershipRow[]).flatMap((m) => (m.communities ? [m.communities] : [])),
  };
}
