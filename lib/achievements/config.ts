/** Badges and levels. Keys are stored in user_achievements.achievement_key. */

export type BadgeCategory = "trash" | "beach" | "community";

export type FixedAchievementKey =
  | "first_cleanup"
  | "ten_cleanups"
  | "first_beach"
  | "three_beaches"
  | "five_beaches"
  | "community_member"
  | "community_connector"
  | "crew_leader";

/** Trash badges are open-ended: one per 10 items logged (trash_10, trash_20, ...). */
export type TrashAchievementKey = `trash_${number}`;
export type AchievementKey = FixedAchievementKey | TrashAchievementKey;

export type AchievementInfo = { name: string; description: string; category: BadgeCategory };

export const ACHIEVEMENTS: Record<FixedAchievementKey, AchievementInfo> = {
  first_cleanup: { name: "First Cleanup", description: "Posted a first cleanup", category: "beach" },
  ten_cleanups: { name: "10 Cleanups", description: "Posted ten cleanups", category: "beach" },
  first_beach: { name: "First Beach", description: "Cleaned a first beach", category: "beach" },
  three_beaches: { name: "3 Beaches", description: "Cleaned three different beaches", category: "beach" },
  five_beaches: { name: "5 Beaches", description: "Cleaned five different beaches", category: "beach" },
  community_member: { name: "Community Member", description: "Joined a first community", category: "community" },
  community_connector: { name: "Connector", description: "Joined three communities", category: "community" },
  crew_leader: { name: "Crew Leader", description: "Hosted a cleanup with 5 or more people", category: "community" },
};

/** Items logged in one clean session that unlock badges and levels. */
export const GAMIFICATION_UNLOCK_ITEMS = 5;
export const TRASH_BADGE_STEP = 10;

const TRASH_KEY = /^trash_(\d+)$/;

/** Name, description, and category for any stored key, or null for a key this build doesn't know. */
export function achievementInfo(key: string): AchievementInfo | null {
  const trash = TRASH_KEY.exec(key);
  if (trash) {
    const count = Number(trash[1]);
    return { name: `${count} Items`, description: `Logged ${count} pieces of trash`, category: "trash" };
  }
  return key in ACHIEVEMENTS ? ACHIEVEMENTS[key as FixedAchievementKey] : null;
}

export function achievementName(key: string): string {
  return achievementInfo(key)?.name ?? "New badge";
}

/** The next trash badge to aim for, e.g. 23 items logged -> 30. */
export function nextTrashBadge(totalItems: number): number {
  return (Math.floor(totalItems / TRASH_BADGE_STEP) + 1) * TRASH_BADGE_STEP;
}

/** Levels by total cleanups, highest first. */
export const LEVELS = [
  { name: "Guardian", minCleanups: 15 },
  { name: "Steward", minCleanups: 5 },
  { name: "Beachcomber", minCleanups: 1 },
  { name: "Newcomer", minCleanups: 0 },
] as const;

export function levelFor(totalCleanups: number) {
  return LEVELS.find((l) => totalCleanups >= l.minCleanups) ?? LEVELS[LEVELS.length - 1];
}

/** How many more cleanups until the next level, or null at the top. */
export function cleanupsToNextLevel(totalCleanups: number): { name: string; remaining: number } | null {
  const next = [...LEVELS].reverse().find((l) => l.minCleanups > totalCleanups);
  return next ? { name: next.name, remaining: next.minCleanups - totalCleanups } : null;
}
