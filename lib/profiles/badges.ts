/** Turns stored achievement rows plus a trash total into the three profile badge groups. */

import { ACHIEVEMENTS, achievementInfo, nextTrashBadge, type BadgeCategory, type FixedAchievementKey } from "@/lib/achievements/config";

/** A row of user_achievements. */
export type EarnedAchievement = { achievement_key: string; earned_at: string };

export type Badge = {
  key: string;
  name: string;
  description: string;
  /** Null when the badge is still locked. */
  earnedAt: string | null;
  /** Set on the one locked badge the person is actively working toward. */
  progress: { current: number; target: number } | null;
};

export type BadgeGroup = {
  category: BadgeCategory;
  title: string;
  badges: Badge[];
  /** Earned trash badges left out of the list to keep it short. */
  moreEarned: number;
};

/** How many earned trash badges to show before summarising the rest as a count. */
export const MAX_TRASH_BADGES = 6;

const TRASH_KEY = /^trash_(\d+)$/;

const GROUP_TITLES: Record<BadgeCategory, string> = { trash: "Trash", beach: "Beach", community: "Community" };

function badge(key: string, earnedAt: string | null, progress: Badge["progress"] = null): Badge | null {
  const info = achievementInfo(key);
  return info ? { key, name: info.name, description: info.description, earnedAt, progress } : null;
}

/**
 * The trash group: the highest earned milestones, then the next one as a
 * locked target with progress toward it.
 */
function trashGroup(rows: EarnedAchievement[], totalItems: number): BadgeGroup {
  const earned = rows
    .flatMap((r) => {
      const match = TRASH_KEY.exec(r.achievement_key);
      return match ? [{ key: r.achievement_key, count: Number(match[1]), earnedAt: r.earned_at }] : [];
    })
    .sort((a, b) => b.count - a.count);

  const badges = earned.slice(0, MAX_TRASH_BADGES).flatMap((t) => badge(t.key, t.earnedAt) ?? []);

  // The next milestone is always above the total, so it cannot already be
  // earned unless the totals view is unavailable and reads as zero.
  const target = nextTrashBadge(totalItems);
  const targetKey = `trash_${target}`;
  if (!earned.some((t) => t.key === targetKey)) {
    const next = badge(targetKey, null, { current: totalItems, target });
    if (next) badges.push(next);
  }

  return { category: "trash", title: GROUP_TITLES.trash, badges, moreEarned: Math.max(0, earned.length - MAX_TRASH_BADGES) };
}

/** Beach and community groups list every badge this build knows, earned or not. */
function fixedGroup(category: BadgeCategory, earnedAt: Map<string, string>): BadgeGroup {
  const badges = (Object.keys(ACHIEVEMENTS) as FixedAchievementKey[])
    .filter((key) => ACHIEVEMENTS[key].category === category)
    .map((key) => ({ key, name: ACHIEVEMENTS[key].name, description: ACHIEVEMENTS[key].description, earnedAt: earnedAt.get(key) ?? null, progress: null }));
  return { category, title: GROUP_TITLES[category], badges, moreEarned: 0 };
}

/** Trash, beach, and community groups, in the order the profile shows them. */
export function buildBadgeGroups(rows: EarnedAchievement[], totalItems: number): BadgeGroup[] {
  const earnedAt = new Map(rows.map((r) => [r.achievement_key, r.earned_at]));
  return [trashGroup(rows, totalItems), fixedGroup("beach", earnedAt), fixedGroup("community", earnedAt)];
}

/** How many badges in a group the person has earned, for the group's summary line. */
export function earnedCount(group: BadgeGroup): number {
  return group.badges.filter((b) => b.earnedAt).length + group.moreEarned;
}
