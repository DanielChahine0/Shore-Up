import type { Band, DataSource, LitterLevel, WaterStatus } from "./config";

/** Raw per-zone inputs, before any score rule is applied. */
export type ZoneState = {
  zoneId: string;
  beachId: string;
  name: string;
  position: number;
  waterStatus: WaterStatus;
  waterSource: DataSource;
  waterObservedAt: string;
  lastCleanedAt: string;
  /** "volunteer" once a real cleanup post exists for the zone, otherwise "demo". */
  litterSource: DataSource;
};

/**
 * Where zone inputs come from. The demo file, Supabase, and (later) the Python
 * forecasting service all sit behind this, so the UI never changes.
 */
export interface ZoneStateSource {
  getZoneStates(beachId: string): Promise<ZoneState[]>;
}

export type ZoneScore = {
  zoneId: string;
  beachId: string;
  name: string;
  position: number;
  score: number;
  band: Band;
  label: string;
  color: string;
  waterStatus: WaterStatus;
  litterLevel: LitterLevel;
  lastCleanedAt: string;
  updatedAt: string;
  waterSource: DataSource;
  litterSource: DataSource;
  /** True when unsafe water forced this zone into Avoid. */
  unsafeOverride: boolean;
  /** One plain-words line, e.g. "Poor: heavy litter, last cleaned 14 days ago". */
  summary: string;
};

export type BeachScore = {
  beachId: string;
  score: number;
  band: Band;
  label: string;
  color: string;
  reason: string;
  hasDemoData: boolean;
  updatedAt: string | null;
  zones: ZoneScore[];
};
