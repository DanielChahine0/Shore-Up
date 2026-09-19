import "server-only";
import { getBeach } from "@/lib/beaches";
import { postPhotoUrl } from "@/lib/images/urls";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

export type Community = {
  id: string;
  slug: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  memberCount: number;
  nonprofit: { id: string; slug: string; name: string; description: string; url: string | null } | null;
};

type OverviewRow = {
  id: string;
  slug: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  member_count: number;
  nonprofit_id: string | null;
  nonprofit_slug: string | null;
  nonprofit_name: string | null;
  nonprofit_description: string | null;
  nonprofit_url: string | null;
};

function toCommunity(r: OverviewRow): Community {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    area: r.area,
    lat: Number(r.lat),
    lng: Number(r.lng),
    memberCount: r.member_count,
    nonprofit: r.nonprofit_id
      ? { id: r.nonprofit_id, slug: r.nonprofit_slug!, name: r.nonprofit_name!, description: r.nonprofit_description ?? "", url: r.nonprofit_url }
      : null,
  };
}

export async function listCommunities(): Promise<Community[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("community_overview").select("*").order("name");
  if (error) throw new Error(`Could not load communities: ${error.message}`);
  return (data as OverviewRow[]).map(toCommunity);
}

export async function getCommunity(slug: string): Promise<Community | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("community_overview").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Could not load community: ${error.message}`);
  return data ? toCommunity(data as OverviewRow) : null;
}

/** Slugs of the communities a user belongs to, oldest membership first. */
export async function listMemberships(userId: string): Promise<{ id: string; slug: string; name: string }[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("community_members").select("joined_at, communities(id, slug, name)").eq("user_id", userId).order("joined_at");
  if (error) throw new Error(`Could not load memberships: ${error.message}`);
  type Row = { communities: { id: string; slug: string; name: string } | null };
  return ((data ?? []) as unknown as Row[]).flatMap((r) => (r.communities ? [r.communities] : []));
}

export type FeedPost = {
  id: string;
  communitySlug: string;
  communityName: string;
  beachId: string;
  beachName: string;
  zoneName: string;
  body: string;
  bags: number;
  createdAt: string;
  /** Null when the author's profile is not public. */
  author: { username: string; displayName: string; avatarUrl: string | null } | null;
  authorId: string;
  likeCount: number;
  likedByViewer: boolean;
  photoUrls: string[];
};

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

/** Newest posts for a community or a beach. */
export async function listPosts(filter: { communityId: string } | { beachId: string }, viewerId: string | null, limit = 30): Promise<FeedPost[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await supabaseServer();
  const base = supabase.from("post_feed").select("*").order("created_at", { ascending: false }).limit(limit);
  const { data, error } = await ("communityId" in filter ? base.eq("community_id", filter.communityId) : base.eq("beach_id", filter.beachId));
  if (error) throw new Error(`Could not load posts: ${error.message}`);
  const rows = (data ?? []) as FeedRow[];

  let liked = new Set<string>();
  if (viewerId && rows.length > 0) {
    const likes = await supabase.from("post_likes").select("post_id").eq("user_id", viewerId).in("post_id", rows.map((r) => r.id));
    if (likes.error) throw new Error(`Could not load likes: ${likes.error.message}`);
    liked = new Set((likes.data ?? []).map((l) => l.post_id as string));
  }

  return rows.map((r) => ({
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
}
