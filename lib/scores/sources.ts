import "server-only";
import officialReadings from "@/data/seed/water-official.json";
import demoState from "@/data/seed/zone-state.json";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import type { DataSource, WaterStatus } from "./config";
import type { ZoneStateSource } from "./types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export type DemoZoneState = {
  zoneId: string;
  beachId: string;
  name: string;
  position: number;
  waterStatus: WaterStatus;
  /** Relative ages, so the demo reads the same on any day. */
  waterObservedHoursAgo: number;
  lastCleanedDaysAgo: number;
};

/**
 * The latest published result for a zone from the authority that samples its water,
 * imported by `pnpm fetch:beaches`. `detail` is the result in the authority's own terms.
 */
export type OfficialReading = {
  zoneId: string;
  beachId: string;
  waterStatus: WaterStatus;
  observedAt: string;
  authority: "toronto" | "nsw-beachwatch" | "eea";
  siteId: string;
  siteName: string;
  detail: string;
};

const officialByZone = new Map((officialReadings as OfficialReading[]).map((r) => [r.zoneId, r]));

/**
 * Seeded data from the repo: official water readings where an authority publishes them,
 * demo values everywhere else. Used until Supabase is configured.
 */
export const demoFileSource: ZoneStateSource = {
  async getZoneStates(beachId, at) {
    const now = at.getTime();
    return (demoState as DemoZoneState[])
      .filter((z) => z.beachId === beachId)
      .map((z) => ({ z, official: officialByZone.get(z.zoneId) }))
      .map(({ z, official }) => ({
        zoneId: z.zoneId,
        beachId: z.beachId,
        name: z.name,
        position: z.position,
        waterStatus: official?.waterStatus ?? z.waterStatus,
        waterSource: official ? ("official" as const) : ("demo" as const),
        waterObservedAt: official?.observedAt ?? new Date(now - z.waterObservedHoursAgo * MS_PER_HOUR).toISOString(),
        lastCleanedAt: new Date(now - z.lastCleanedDaysAgo * MS_PER_DAY).toISOString(),
        litterSource: "demo" as const,
      }));
  },
};

type ZoneStateRow = {
  zone_id: string;
  beach_id: string;
  name: string;
  position: number;
  water_status: WaterStatus;
  water_source: DataSource;
  water_observed_at: string;
  last_cleaned_at: string;
  litter_source: DataSource;
};

/**
 * Reads the zone_state view: latest water reading plus latest cleanup post per zone.
 *
 * Demo litter ages are rebuilt here from the stored day count rather than taken from the
 * view's timestamp, and measured against the caller's `now`. Any second reading of a clock
 * (the database's, or this server's a request later) lands a few milliseconds off, which is
 * enough to turn "14 days ago" into 13 and change a band. One instant, no drift.
 */
export const supabaseSource: ZoneStateSource = {
  async getZoneStates(beachId, at) {
    const supabase = await supabaseServer();
    const [state, demo] = await Promise.all([
      supabase.from("zone_state").select("*").eq("beach_id", beachId),
      supabase.from("zones").select("id, demo_last_cleaned_days").eq("beach_id", beachId),
    ]);
    if (state.error) throw new Error(`zone_state query failed: ${state.error.message}`);
    if (demo.error) throw new Error(`zones query failed: ${demo.error.message}`);

    const now = at.getTime();
    const demoDays = new Map((demo.data ?? []).map((z) => [z.id as string, z.demo_last_cleaned_days as number]));
    return (state.data as ZoneStateRow[]).map((r) => ({
      zoneId: r.zone_id,
      beachId: r.beach_id,
      name: r.name,
      position: r.position,
      waterStatus: r.water_status,
      waterSource: r.water_source,
      waterObservedAt: r.water_observed_at,
      lastCleanedAt: r.litter_source === "demo" ? new Date(now - (demoDays.get(r.zone_id) ?? 0) * MS_PER_DAY).toISOString() : r.last_cleaned_at,
      litterSource: r.litter_source,
    }));
  },
};

export function activeZoneStateSource(): ZoneStateSource {
  return supabaseConfigured() ? supabaseSource : demoFileSource;
}
