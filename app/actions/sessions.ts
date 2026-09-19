"use server";

import { revalidatePath } from "next/cache";
import { getBeach } from "@/lib/beaches";
import { supabaseServer } from "@/lib/supabase/server";
import { MAX_PER_ITEM, TRASH_ITEMS, type CleanSessionResult, type TrashCounts } from "@/lib/trash/config";

export type SaveCleanSessionInput = {
  /** ISO 8601, from the device that ran the session. */
  startedAt: string;
  items: TrashCounts;
  beachId: string | null;
};

export type SaveCleanSessionResult = { ok: true; result: CleanSessionResult } | { ok: false; error: string };

const ITEM_KEYS = new Set<string>(TRASH_ITEMS.map((item) => item.key));
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Saves one finished clean session. The database function writes the session,
 * its items, and any badges it earns in a single transaction, so these checks
 * are only here to fail early with wording a volunteer can act on.
 */
export async function saveCleanSession(input: SaveCleanSessionInput): Promise<SaveCleanSessionResult> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in to save this session." };

  const startedAt = Date.parse(input.startedAt);
  const now = Date.now();
  if (Number.isNaN(startedAt) || startedAt > now || now - startedAt > MAX_SESSION_AGE_MS) {
    return { ok: false, error: "This session is too old to save. Sessions have to be saved within a day of starting." };
  }

  if (input.beachId && !getBeach(input.beachId)) return { ok: false, error: "That beach is not on Shore Up." };

  const entries = Object.entries(input.items ?? {});
  let total = 0;
  for (const [key, count] of entries) {
    if (!ITEM_KEYS.has(key)) return { ok: false, error: "That session has an item we don't know about." };
    if (!Number.isInteger(count) || count < 1 || count > MAX_PER_ITEM) {
      return { ok: false, error: `Each item has to be a whole number from 1 to ${MAX_PER_ITEM}.` };
    }
    total += count;
  }
  if (total < 1) return { ok: false, error: "Log at least one item before finishing." };

  const { data, error } = await supabase.rpc("log_clean_session", {
    p_started_at: new Date(startedAt).toISOString(),
    p_items: Object.fromEntries(entries),
    p_beach: input.beachId,
    p_zone: null,
  });
  if (error) return { ok: false, error: `The session didn't save: ${error.message}` };

  revalidatePath("/profile", "layout");
  revalidatePath("/people");

  const row = data as { session_id: string; total_items: number; lifetime_items: number; unlocked_now: boolean; new_achievements: string[] };
  return {
    ok: true,
    result: {
      sessionId: row.session_id,
      totalItems: row.total_items,
      lifetimeItems: row.lifetime_items,
      unlockedNow: row.unlocked_now,
      newAchievements: row.new_achievements ?? [],
    },
  };
}
