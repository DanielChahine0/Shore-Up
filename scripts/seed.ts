/**
 * Seeds Supabase with demo data. Safe to re-run: reference rows are upserted
 * and demo water readings are replaced.
 *
 * Phase 1 seeds beaches, zones, and demo water readings. People, communities,
 * posts, and cleanups are added to this script in later phases.
 *
 * Usage: pnpm seed   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { FeatureCollection } from "geojson";
import type { DemoZoneState } from "../lib/scores/sources";

const ROOT = path.resolve(__dirname, "..");
config({ path: path.join(ROOT, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(ROOT, file), "utf8")) as T;

function check(step: string, error: { message: string } | null) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function main() {
  const beaches = await readJson<FeatureCollection>("data/geo/beaches.json");
  const zoneStates = await readJson<DemoZoneState[]>("data/seed/zone-state.json");

  const beachRows = beaches.features.map((f) => {
    const p = f.properties as { id: string; name: string; area: string; country: string; lng: number; lat: number; osm_id: string };
    return { id: p.id, name: p.name, area: p.area, country: p.country, lng: p.lng, lat: p.lat, osm_id: p.osm_id };
  });
  check("beaches", (await supabase.from("beaches").upsert(beachRows)).error);

  const zoneRows = zoneStates.map((z) => ({
    id: z.zoneId,
    beach_id: z.beachId,
    name: z.name,
    position: z.position,
    demo_last_cleaned_days: z.lastCleanedDaysAgo,
  }));
  check("zones", (await supabase.from("zones").upsert(zoneRows)).error);

  // Replace demo readings only. Official, model, and volunteer readings are never touched.
  check("clear demo water readings", (await supabase.from("water_readings").delete().eq("source", "demo")).error);
  const now = Date.now();
  const readingRows = zoneStates.map((z) => ({
    zone_id: z.zoneId,
    status: z.waterStatus,
    source: "demo",
    observed_at: new Date(now - z.waterObservedHoursAgo * 3_600_000).toISOString(),
  }));
  check("water readings", (await supabase.from("water_readings").insert(readingRows)).error);

  console.log(`Seeded ${beachRows.length} beaches, ${zoneRows.length} zones, ${readingRows.length} demo water readings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
