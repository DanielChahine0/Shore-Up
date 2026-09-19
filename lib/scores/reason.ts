import { LITTER_PHRASES } from "./config";
import { daysSince } from "./compute";
import type { ZoneScore } from "./types";

export function daysAgoText(iso: string, now: Date): string {
  const days = daysSince(iso, now);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function zoneSummary(zone: Omit<ZoneScore, "summary">, now: Date): string {
  if (zone.unsafeOverride) return `${zone.label}: water is unsafe, whatever the sand looks like`;
  const litter = `${LITTER_PHRASES[zone.litterLevel]}, last cleaned ${daysAgoText(zone.lastCleanedAt, now)}`;
  return zone.waterStatus === "caution" ? `${zone.label}: water needs caution, ${litter}` : `${zone.label}: ${litter}`;
}

function listNames(zones: ZoneScore[]): string {
  const names = zones.map((z) => z.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The plain-words explanation shown in the beach panel. */
export function beachReason(zones: ZoneScore[]): string {
  if (zones.length === 0) return "No zone data yet for this beach.";
  const parts: string[] = [];

  const clean = zones.filter((z) => z.band === "clean");
  if (clean.length === zones.length) parts.push("Every zone is clean: safe water and little litter.");
  else if (clean.length > 0) parts.push(`${clean.length} of ${zones.length} zones are clean.`);
  else parts.push("No zone is fully clean right now.");

  const unsafe = zones.filter((z) => z.unsafeOverride);
  if (unsafe.length > 0) {
    const verb = unsafe.length === 1 ? "shows" : "show";
    parts.push(`${listNames(unsafe)} ${verb} red because the water is unsafe, no matter how clean the sand is.`);
  }

  const heavy = zones.filter((z) => !z.unsafeOverride && z.litterLevel === "high");
  if (heavy.length > 0) {
    const verb = heavy.length === 1 ? "has" : "have";
    parts.push(`${listNames(heavy)} ${verb} heavy litter and ${heavy.length === 1 ? "needs" : "need"} a cleanup.`);
  }

  const caution = zones.filter((z) => z.waterStatus === "caution");
  if (caution.length > 0) parts.push(`Water needs caution in ${listNames(caution)}.`);

  const drifting = zones.filter((z) => !z.unsafeOverride && z.litterLevel === "medium");
  if (drifting.length > 0 && heavy.length === 0) {
    parts.push(`${listNames(drifting)} ${drifting.length === 1 ? "is" : "are"} due for a cleanup soon.`);
  }

  return parts.join(" ");
}
