import "server-only";
import { bandFor, beachScore } from "./compute";
import { beachReason } from "./reason";
import { scoreZone } from "./scoreZone";
import { activeZoneStateSource } from "./sources";
import type { BeachScore, ZoneScore } from "./types";

/**
 * The one data interface for scores. Everything the UI shows about a beach's
 * cleanliness comes through here.
 */
export async function getBeachZones(beachId: string, now: Date = new Date()): Promise<ZoneScore[]> {
  const states = await activeZoneStateSource().getZoneStates(beachId, now);
  return states.map((s) => scoreZone(s, now)).sort((a, b) => a.position - b.position);
}

export async function getBeachScore(beachId: string, now: Date = new Date()): Promise<BeachScore> {
  const zones = await getBeachZones(beachId, now);
  const score = beachScore(zones.map((z) => z.score));
  const band = bandFor(score);
  return {
    beachId,
    score,
    band: band.band,
    label: band.label,
    color: band.color,
    reason: beachReason(zones),
    hasDemoData: zones.some((z) => z.waterSource === "demo" || z.litterSource === "demo"),
    updatedAt: zones.reduce<string | null>((latest, z) => (!latest || z.updatedAt > latest ? z.updatedAt : latest), null),
    zones,
  };
}
