import { describe, expect, it } from "vitest";
import { GAMIFICATION_UNLOCK_ITEMS } from "@/lib/achievements/config";
import { MAX_PER_ITEM, totalItems } from "@/lib/trash/config";
import { MAX_SESSION_AGE_MS, adjustCount, cleanCounts, finishMessage, itemLabel, newSession, parseSession, parseSessionList, unlockProgress } from "@/components/trash/session";

const NOW = Date.parse("2026-09-19T12:00:00.000Z");

describe("adjustCount", () => {
  it("adds and removes one at a time", () => {
    let counts = adjustCount({}, "plastic_bottle", 1);
    expect(counts).toEqual({ plastic_bottle: 1 });
    counts = adjustCount(counts, "plastic_bottle", 1);
    counts = adjustCount(counts, "straw", 1);
    expect(counts).toEqual({ plastic_bottle: 2, straw: 1 });
    expect(totalItems(counts)).toBe(3);
  });

  it("drops an item once it is back at zero rather than storing a 0", () => {
    const counts = adjustCount({ straw: 1 }, "straw", -1);
    expect(counts).toEqual({});
    expect(Object.keys(counts)).toHaveLength(0);
  });

  it("never goes below zero or above the per-item cap", () => {
    expect(adjustCount({}, "can", -1)).toEqual({});
    expect(adjustCount({ can: MAX_PER_ITEM }, "can", 1)).toEqual({ can: MAX_PER_ITEM });
  });

  it("leaves the counts it was given alone", () => {
    const before = { can: 1 };
    adjustCount(before, "can", 1);
    expect(before).toEqual({ can: 1 });
  });
});

describe("cleanCounts", () => {
  it("keeps only known keys with whole counts in range", () => {
    const counts = cleanCounts({ plastic_bottle: 3, unknown_thing: 2, straw: 0, can: 1.5, glass: MAX_PER_ITEM + 1, paper: 7 });
    expect(counts).toEqual({ plastic_bottle: 3, paper: 7 });
  });

  it("returns nothing for values that are not an object of counts", () => {
    expect(cleanCounts(null)).toEqual({});
    expect(cleanCounts("plastic_bottle")).toEqual({});
    expect(cleanCounts([1, 2])).toEqual({});
  });
});

describe("parseSession", () => {
  const stored = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ startedAt: new Date(NOW - 60_000).toISOString(), counts: { can: 2 }, beachId: "b1", beachName: "Cherry Beach", ...over });

  it("reads a session the device wrote earlier", () => {
    expect(parseSession(stored(), NOW)).toEqual({
      startedAt: new Date(NOW - 60_000).toISOString(),
      counts: { can: 2 },
      beachId: "b1",
      beachName: "Cherry Beach",
    });
  });

  it("returns null for nothing stored, broken JSON, or the wrong shape", () => {
    expect(parseSession(null, NOW)).toBeNull();
    expect(parseSession("{not json", NOW)).toBeNull();
    expect(parseSession(JSON.stringify([1]), NOW)).toBeNull();
    expect(parseSession(stored({ startedAt: 17 }), NOW)).toBeNull();
    expect(parseSession(stored({ startedAt: "not a date" }), NOW)).toBeNull();
  });

  it("refuses a session too old to save, or one that claims to start in the future", () => {
    expect(parseSession(stored({ startedAt: new Date(NOW - MAX_SESSION_AGE_MS - 1000).toISOString() }), NOW)).toBeNull();
    expect(parseSession(stored({ startedAt: new Date(NOW + 60_000).toISOString() }), NOW)).toBeNull();
  });

  it("survives a session whose counts were tampered with", () => {
    expect(parseSession(stored({ counts: { can: -4, nope: 9 } }), NOW)?.counts).toEqual({});
    expect(parseSession(stored({ counts: "all of it", beachId: 12 }), NOW)).toEqual({
      startedAt: new Date(NOW - 60_000).toISOString(),
      counts: {},
      beachId: null,
      beachName: "Cherry Beach",
    });
  });
});

describe("parseSessionList", () => {
  it("keeps the guest sessions that can still be saved", () => {
    const raw = JSON.stringify([
      { startedAt: new Date(NOW - 60_000).toISOString(), counts: { can: 2 } },
      { startedAt: new Date(NOW - 60_000).toISOString(), counts: {} },
      { startedAt: new Date(NOW - MAX_SESSION_AGE_MS - 1).toISOString(), counts: { can: 9 } },
    ]);
    const list = parseSessionList(raw, NOW);
    expect(list).toHaveLength(1);
    expect(list[0].counts).toEqual({ can: 2 });
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseSessionList(null, NOW)).toEqual([]);
    expect(parseSessionList("{}", NOW)).toEqual([]);
    expect(parseSessionList("[", NOW)).toEqual([]);
  });
});

describe("newSession", () => {
  it("records the start time and the beach the map has open", () => {
    const session = newSession({ id: "b1", name: "Cherry Beach" }, new Date(NOW));
    expect(session).toEqual({ startedAt: new Date(NOW).toISOString(), counts: {}, beachId: "b1", beachName: "Cherry Beach" });
  });

  it("runs without a beach", () => {
    const session = newSession(null, new Date(NOW));
    expect(session.beachId).toBeNull();
    expect(session.beachName).toBeNull();
  });
});

describe("unlockProgress", () => {
  it("counts down to the items that open up badges", () => {
    expect(unlockProgress({})).toEqual({ total: 0, needed: GAMIFICATION_UNLOCK_ITEMS, unlocked: false, remaining: 5 });
    expect(unlockProgress({ can: 3 })).toMatchObject({ total: 3, unlocked: false, remaining: 2 });
  });

  it("unlocks at five items in one session and stays unlocked", () => {
    expect(unlockProgress({ can: 3, straw: 2 })).toMatchObject({ total: 5, unlocked: true, remaining: 0 });
    expect(unlockProgress({ can: 40 })).toMatchObject({ total: 40, unlocked: true, remaining: 0 });
  });
});

describe("itemLabel", () => {
  it("only pluralises when it should", () => {
    expect(itemLabel(0)).toBe("0 items");
    expect(itemLabel(1)).toBe("1 item");
    expect(itemLabel(2)).toBe("2 items");
  });
});

describe("finishMessage", () => {
  const base = { sessionId: "s1", totalItems: 14, lifetimeItems: 14, unlockedNow: false, newAchievements: [] };

  it("reports the total on its own", () => {
    expect(finishMessage(base)).toBe("Session saved: 14 items.");
  });

  it("names the badges that were earned", () => {
    expect(finishMessage({ ...base, newAchievements: ["trash_10"] })).toBe("Session saved: 14 items. Badge earned: 10 Items.");
  });

  it("says badges and levels are open once they unlock", () => {
    expect(finishMessage({ ...base, totalItems: 1, unlockedNow: true, newAchievements: ["trash_10", "first_beach"] })).toBe(
      "Session saved: 1 item. Badges and levels are now unlocked on your profile. Badge earned: 10 Items, First Beach.",
    );
  });
});
