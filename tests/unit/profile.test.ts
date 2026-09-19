import { describe, expect, it } from "vitest";
import { buildBadgeGroups, earnedCount, MAX_TRASH_BADGES, type EarnedAchievement } from "@/lib/profiles/badges";

const at = (key: string, earned_at = "2026-03-01T12:00:00Z"): EarnedAchievement => ({ achievement_key: key, earned_at });

/** Trash milestones for 10, 20, ... up to `count` badges. */
const trashRows = (count: number) => Array.from({ length: count }, (_, i) => at(`trash_${(i + 1) * 10}`));

describe("buildBadgeGroups", () => {
  it("returns the trash, beach, and community groups in page order", () => {
    const groups = buildBadgeGroups([], 0);
    expect(groups.map((g) => g.category)).toEqual(["trash", "beach", "community"]);
    expect(groups.map((g) => g.title)).toEqual(["Trash", "Beach", "Community"]);
  });

  it("lists every beach and community badge, earned or locked, with its description", () => {
    const [, beach, community] = buildBadgeGroups([at("first_beach"), at("crew_leader")], 0);

    expect(beach.badges.map((b) => b.key)).toEqual(["first_cleanup", "ten_cleanups", "first_beach", "three_beaches", "five_beaches"]);
    expect(beach.badges.find((b) => b.key === "first_beach")?.earnedAt).toBe("2026-03-01T12:00:00Z");
    expect(beach.badges.find((b) => b.key === "three_beaches")?.earnedAt).toBeNull();
    expect(beach.badges.every((b) => b.description.length > 0)).toBe(true);

    expect(community.badges.map((b) => b.key)).toEqual(["community_member", "community_connector", "crew_leader"]);
    expect(earnedCount(community)).toBe(1);
  });

  it("adds the next trash milestone as a locked target with progress", () => {
    const [trash] = buildBadgeGroups(trashRows(2), 23);

    expect(trash.badges.map((b) => b.key)).toEqual(["trash_20", "trash_10", "trash_30"]);
    const target = trash.badges[2];
    expect(target.earnedAt).toBeNull();
    expect(target.progress).toEqual({ current: 23, target: 30 });
    expect(target.name).toBe("30 Items");
    // The earned ones carry no progress bar of their own.
    expect(trash.badges.slice(0, 2).every((b) => b.progress === null)).toBe(true);
  });

  it("aims at the first milestone for someone with nothing logged", () => {
    const [trash] = buildBadgeGroups([], 0);
    expect(trash.badges).toHaveLength(1);
    expect(trash.badges[0].progress).toEqual({ current: 0, target: 10 });
    expect(earnedCount(trash)).toBe(0);
  });

  it("shows the highest trash badges and counts the rest", () => {
    const [trash] = buildBadgeGroups(trashRows(9), 95);

    expect(trash.badges.filter((b) => b.earnedAt)).toHaveLength(MAX_TRASH_BADGES);
    expect(trash.badges.slice(0, MAX_TRASH_BADGES).map((b) => b.key)).toEqual(["trash_90", "trash_80", "trash_70", "trash_60", "trash_50", "trash_40"]);
    expect(trash.moreEarned).toBe(3);
    // The count of the rest is part of the group's earned total.
    expect(earnedCount(trash)).toBe(9);
  });

  it("never repeats the target when the totals view is unavailable", () => {
    // trash_stats missing reads as zero items even though milestones are stored.
    const [trash] = buildBadgeGroups(trashRows(3), 0);
    const keys = trash.badges.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("trash_40");
  });

  it("ignores keys this build does not know", () => {
    const groups = buildBadgeGroups([at("from_a_future_release")], 0);
    expect(groups.flatMap((g) => g.badges).some((b) => b.key === "from_a_future_release")).toBe(false);
  });
});
