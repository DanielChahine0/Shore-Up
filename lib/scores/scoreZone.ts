import { bandFor, litterLevelFor, zoneScore } from "./compute";
import { zoneSummary } from "./reason";
import type { ZoneScore, ZoneState } from "./types";

/** Applies the score rules to one zone's raw inputs. */
export function scoreZone(state: ZoneState, now: Date): ZoneScore {
  const litterLevel = litterLevelFor(state.lastCleanedAt, now);
  const score = zoneScore(state.waterStatus, litterLevel);
  const band = bandFor(score);
  const updatedAt = state.waterObservedAt > state.lastCleanedAt ? state.waterObservedAt : state.lastCleanedAt;
  const zone = {
    zoneId: state.zoneId,
    beachId: state.beachId,
    name: state.name,
    position: state.position,
    score,
    band: band.band,
    label: band.label,
    color: band.color,
    waterStatus: state.waterStatus,
    litterLevel,
    lastCleanedAt: state.lastCleanedAt,
    updatedAt,
    waterSource: state.waterSource,
    litterSource: state.litterSource,
    unsafeOverride: state.waterStatus === "unsafe",
  };
  return { ...zone, summary: zoneSummary(zone, now) };
}
