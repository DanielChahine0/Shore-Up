"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBeach } from "@/lib/beaches";
import { supabaseServer } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Adds the signed-in user to a cleanup. Signed-out users are sent to sign in and brought back. */
export async function joinCleanup(cleanupId: string, returnTo: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);

  const { error } = await supabase.rpc("join_cleanup", { target_cleanup: cleanupId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/people");
  revalidatePath(`/cleanups/${cleanupId}`);
  return { ok: true, message: "Joined. It's on your profile and the cleanup page." };
}

export async function leaveCleanup(cleanupId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("cleanup_attendees").delete().eq("cleanup_id", cleanupId).eq("user_id", auth.user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/people");
  revalidatePath(`/cleanups/${cleanupId}`);
  return { ok: true, message: "You left this cleanup." };
}

export type CreateCleanupState = { error?: string };

export async function createCleanup(_prev: CreateCleanupState, form: FormData): Promise<CreateCleanupState> {
  const beachId = String(form.get("beach_id") ?? "");
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/signin?next=${encodeURIComponent(`/beach/${beachId}`)}`);

  if (!getBeach(beachId)) return { error: "Pick a beach." };
  const startsAt = new Date(String(form.get("starts_at") ?? ""));
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) return { error: "Pick a date and time in the future." };
  const zoneId = String(form.get("zone_id") ?? "") || null;
  const notes = String(form.get("notes") ?? "").trim();
  if (notes.length > 1000) return { error: "Keep notes under 1000 characters." };

  const { data, error } = await supabase
    .from("cleanups")
    .insert({ beach_id: beachId, zone_id: zoneId, organizer_id: auth.user.id, starts_at: startsAt.toISOString(), notes })
    .select("id")
    .single();
  if (error) return { error: `The cleanup didn't save: ${error.message}` };

  revalidatePath("/people");
  redirect(`/cleanups/${data.id}`);
}
