/**
 * Generates data/seed/zone-state.json: demo water status and litter age for
 * every zone in data/geo/zones.json. Deterministic, so reruns give the same demo.
 *
 * Usage: pnpm gen:demo
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { FeatureCollection } from "geojson";
import type { WaterStatus } from "../lib/scores/config";
import type { DemoZoneState } from "../lib/scores/sources";

const ROOT = path.resolve(__dirname, "..");

/** Woodbine is hand-set for the demo: green zones, one orange (heavy litter), one red (unsafe water). */
const WOODBINE: Record<number, { waterStatus: WaterStatus; lastCleanedDaysAgo: number }> = {
  1: { waterStatus: "safe", lastCleanedDaysAgo: 1 },
  2: { waterStatus: "safe", lastCleanedDaysAgo: 3 },
  3: { waterStatus: "safe", lastCleanedDaysAgo: 14 },
  4: { waterStatus: "safe", lastCleanedDaysAgo: 2 },
  5: { waterStatus: "unsafe", lastCleanedDaysAgo: 2 },
};

/** FNV-1a, mapped to [0, 1). */
function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

async function main() {
  const zones = JSON.parse(await readFile(path.join(ROOT, "data/geo/zones.json"), "utf8")) as FeatureCollection;
  const states: DemoZoneState[] = zones.features.map((f) => {
    const { id, beach_id, name, position } = f.properties as { id: string; beach_id: string; name: string; position: number };
    const w = rand(`${id}:water`);
    const l = rand(`${id}:litter`);
    const generated = {
      waterStatus: (w < 0.8 ? "safe" : w < 0.94 ? "caution" : "unsafe") as WaterStatus,
      lastCleanedDaysAgo: l < 0.6 ? Math.floor(rand(`${id}:d`) * 7) : l < 0.85 ? 7 + Math.floor(rand(`${id}:d`) * 7) : 14 + Math.floor(rand(`${id}:d`) * 10),
    };
    const hand = beach_id === "woodbine" ? WOODBINE[position] : undefined;
    return {
      zoneId: id,
      beachId: beach_id,
      name,
      position,
      ...(hand ?? generated),
      waterObservedHoursAgo: 1 + Math.floor(rand(`${id}:h`) * 20),
    };
  });
  await mkdir(path.join(ROOT, "data/seed"), { recursive: true });
  await writeFile(path.join(ROOT, "data/seed/zone-state.json"), JSON.stringify(states, null, 1) + "\n");
  console.log(`${states.length} zone states written`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
