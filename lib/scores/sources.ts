import "server-only";
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

/** Seeded demo data from the repo. Used until Supabase is configured. */
export const demoFileSource: ZoneStateSource = {
  async getZoneStates(beachId) {
    const now = Date.now();
    return (demoState as DemoZoneState[])
      .filter((z) => z.beachId === beachId)
      .map((z) => ({
        zoneId: z.zoneId,
        beachId: z.beachId,
        name: z.name,
        position: z.position,
        waterStatus: z.waterStatus,
        waterSource: "demo" as const,
        waterObservedAt: new Date(now - z.waterObservedHoursAgo * MS_PER_HOUR).toISOString(),
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

/** Reads the zone_state view: latest water reading plus latest cleanup post per zone. */
export const supabaseSource: ZoneStateSource = {
  async getZoneStates(beachId) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.from("zone_state").select("*").eq("beach_id", beachId);
    if (error) throw new Error(`zone_state query failed: ${error.message}`);
    return (data as ZoneStateRow[]).map((r) => ({
      zoneId: r.zone_id,
      beachId: r.beach_id,
      name: r.name,
      position: r.position,
      waterStatus: r.water_status,
      waterSource: r.water_source,
      waterObservedAt: r.water_observed_at,
      lastCleanedAt: r.last_cleaned_at,
      litterSource: r.litter_source,
    }));
  },
};

export function activeZoneStateSource(): ZoneStateSource {
  return supabaseConfigured() ? supabaseSource : demoFileSource;
}
