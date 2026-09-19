/**
 * The pure parts of a clean session: counting, what is stored on the device,
 * and the wording used when one is saved. Kept free of React so the rules can
 * be tested directly (tests/unit/trash.test.ts).
 */

import { GAMIFICATION_UNLOCK_ITEMS, achievementName } from "@/lib/achievements/config";
import { MAX_PER_ITEM, TRASH_ITEMS, totalItems, type CleanSessionResult, type TrashCounts, type TrashItemKey } from "@/lib/trash/config";

/** The session running right now, so a reload or a stray tab close does not lose it. */
export const IN_PROGRESS_KEY = "shoreup.clean-session";
/** Sessions a guest finished but could not save yet. */
export const GUEST_SESSIONS_KEY = "shoreup.guest-sessions";

/** A session start time older than this can no longer be saved (the RPC rejects it too). */
export const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export type CleanSession = {
  /** ISO 8601. */
  startedAt: string;
  counts: TrashCounts;
  beachId: string | null;
  beachName: string | null;
};

const ITEM_KEYS = new Set<string>(TRASH_ITEMS.map((item) => item.key));

function isItemKey(key: string): key is TrashItemKey {
  return ITEM_KEYS.has(key);
}

export function newSession(beach: { id: string; name: string } | null, now = new Date()): CleanSession {
  return { startedAt: now.toISOString(), counts: {}, beachId: beach?.id ?? null, beachName: beach?.name ?? null };
}

/**
 * Adds `delta` to one item, clamped to 0..MAX_PER_ITEM. Items back at zero are
 * dropped so the stored object only ever holds what was actually collected.
 */
export function adjustCount(counts: TrashCounts, key: TrashItemKey, delta: number): TrashCounts {
  const next = Math.min(MAX_PER_ITEM, Math.max(0, (counts[key] ?? 0) + delta));
  const updated = { ...counts };
  if (next === 0) delete updated[key];
  else updated[key] = next;
  return updated;
}

/** Counts the device wrote earlier, with anything unrecognised or out of range thrown away. */
export function cleanCounts(value: unknown): TrashCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const counts: TrashCounts = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isItemKey(key) || typeof raw !== "number" || !Number.isInteger(raw)) continue;
    if (raw < 1 || raw > MAX_PER_ITEM) continue;
    counts[key] = raw;
  }
  return counts;
}

/** Turns one stored object into a session, or null if it is malformed or too old to save. */
function fromRecord(value: unknown, now: number): CleanSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.startedAt !== "string") return null;
  const startedAt = Date.parse(record.startedAt);
  if (Number.isNaN(startedAt) || startedAt > now || now - startedAt > MAX_SESSION_AGE_MS) return null;
  return {
    startedAt: new Date(startedAt).toISOString(),
    counts: cleanCounts(record.counts),
    beachId: typeof record.beachId === "string" ? record.beachId : null,
    beachName: typeof record.beachName === "string" ? record.beachName : null,
  };
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reads the stored in-progress session back. Returns null for anything
 * malformed or expired, so a stale session never blocks starting a fresh one.
 */
export function parseSession(raw: string | null, now = Date.now()): CleanSession | null {
  return fromRecord(parseJson(raw), now);
}

/** A stored list of finished guest sessions, dropping any that are empty or expired. */
export function parseSessionList(raw: string | null, now = Date.now()): CleanSession[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  return value.map((entry) => fromRecord(entry, now)).filter((session): session is CleanSession => session !== null && totalItems(session.counts) > 0);
}

export type UnlockProgress = { total: number; needed: number; unlocked: boolean; remaining: number };

/** Progress toward the 5 items in one session that open up badges and levels. */
export function unlockProgress(counts: TrashCounts): UnlockProgress {
  const total = totalItems(counts);
  return {
    total,
    needed: GAMIFICATION_UNLOCK_ITEMS,
    unlocked: total >= GAMIFICATION_UNLOCK_ITEMS,
    remaining: Math.max(0, GAMIFICATION_UNLOCK_ITEMS - total),
  };
}

export function itemLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

/** What the toast says after a session is saved. */
export function finishMessage(result: CleanSessionResult): string {
  const parts = [`Session saved: ${itemLabel(result.totalItems)}.`];
  if (result.unlockedNow) parts.push("Badges and levels are now unlocked on your profile.");
  if (result.newAchievements.length > 0) parts.push(`Badge earned: ${result.newAchievements.map(achievementName).join(", ")}.`);
  return parts.join(" ");
}
