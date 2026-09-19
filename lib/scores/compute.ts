import {
  BANDS,
  LITTER_HIGH_AFTER_DAYS,
  LITTER_MEDIUM_AFTER_DAYS,
  LITTER_POINTS,
  LITTER_WEIGHT,
  UNSAFE_WATER_SCORE_CAP,
  WATER_POINTS,
  WATER_WEIGHT,
  type LitterLevel,
  type WaterStatus,
} from "./config";

const MS_PER_DAY = 86_400_000;

export function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / MS_PER_DAY));
}

/** A cleanup sets litter to Low; it drifts to Medium, then High, without a new one. */
export function litterLevelFor(lastCleanedAt: string, now: Date): LitterLevel {
  const days = daysSince(lastCleanedAt, now);
  if (days >= LITTER_HIGH_AFTER_DAYS) return "high";
  if (days >= LITTER_MEDIUM_AFTER_DAYS) return "medium";
  return "low";
}

export function zoneScore(water: WaterStatus, litter: LitterLevel): number {
  const raw = Math.round(WATER_POINTS[water] * WATER_WEIGHT + LITTER_POINTS[litter] * LITTER_WEIGHT);
  return water === "unsafe" ? Math.min(raw, UNSAFE_WATER_SCORE_CAP) : raw;
}

export function bandFor(score: number) {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export function beachScore(zoneScores: number[]): number {
  if (zoneScores.length === 0) return 0;
  return Math.round(zoneScores.reduce((sum, s) => sum + s, 0) / zoneScores.length);
}
