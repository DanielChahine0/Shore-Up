"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AchievementKey } from "@/lib/achievements/config";
import { supabaseServer } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser(returnTo: string) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return { supabase, userId: auth.user.id };
}

export async function joinCommunity(communityId: string, slug: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser(`/cn/${slug}`);
  const { error } = await supabase.from("community_members").upsert({ community_id: communityId, user_id: userId }, { onConflict: "community_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: `Joining didn't work: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function leaveCommunity(communityId: string, slug: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser(`/cn/${slug}`);
  const { error } = await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId);
  if (error) return { ok: false, error: `Leaving didn't work: ${error.message}` };
  revalidatePath("/", "layout");
  return { ok: true };
}

export type NewPostInput = { communityId: string; communitySlug: string; beachId: string; zoneId: string; body: string; bags: number; photoPaths: string[] };
export type NewPostResult = { ok: true; postId: string; newAchievements: AchievementKey[] } | { ok: false; error: string };

/** Posts a cleanup. The database function writes the post and awards badges in one transaction. */
export async function createPost(input: NewPostInput): Promise<NewPostResult> {
  const { supabase } = await requireUser(`/cn/${input.communitySlug}`);

  const body = input.body.trim();
  if (body.length < 1 || body.length > 2000) return { ok: false, error: "Write a few words about the cleanup, up to 2000 characters." };
  if (!Number.isInteger(input.bags) || input.bags < 0 || input.bags > 500) return { ok: false, error: "Bags collected must be a whole number from 0 to 500." };
  if (input.photoPaths.length < 1 || input.photoPaths.length > 4) return { ok: false, error: "Add between 1 and 4 photos." };

  const { data, error } = await supabase.rpc("create_cleanup_post", {
    p_community: input.communityId,
    p_beach: input.beachId,
    p_zone: input.zoneId,
    p_body: body,
    p_bags: input.bags,
    p_photo_paths: input.photoPaths,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cn/${input.communitySlug}`);
  revalidatePath("/profile", "layout");
  const result = data as { post_id: string; new_achievements: AchievementKey[] };
  return { ok: true, postId: result.post_id, newAchievements: result.new_achievements };
}

export async function toggleLike(postId: string, like: boolean, returnTo: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser(returnTo);
  const { error } = like
    ? await supabase.from("post_likes").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function reportPost(postId: string, reason: string, returnTo: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser(returnTo);
  // A plain insert: reports are write-only for users, and an upsert would need to read them back.
  const { error } = await supabase.from("post_reports").insert({ post_id: postId, reporter_id: userId, reason: reason.trim().slice(0, 500) });
  // 23505 = this person already reported this post, which is fine.
  if (error && error.code !== "23505") return { ok: false, error: `The report didn't send: ${error.message}` };
  return { ok: true };
}
