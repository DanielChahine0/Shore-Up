/** Badges and levels. Keys are stored in user_achievements.achievement_key. */

export type AchievementKey = "first_cleanup" | "five_beaches" | "ten_cleanups" | "crew_leader";

export const ACHIEVEMENTS: Record<AchievementKey, { name: string; description: string }> = {
  first_cleanup: { name: "First Cleanup", description: "Posted a first cleanup" },
  five_beaches: { name: "5 Beaches", description: "Cleaned five different beaches" },
  ten_cleanups: { name: "10 Cleanups", description: "Posted ten cleanups" },
  crew_leader: { name: "Crew Leader", description: "Hosted a cleanup with 5 or more people" },
};

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
