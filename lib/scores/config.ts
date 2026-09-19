/**
 * Every score rule lives here. Change a number in this file and the map,
 * panel, tooltips, and database seed all follow.
 */

export type WaterStatus = "safe" | "caution" | "unsafe";
export type LitterLevel = "low" | "medium" | "high";
export type Band = "clean" | "fair" | "poor" | "avoid";
export type DataSource = "demo" | "official" | "model" | "volunteer";

export const WATER_POINTS: Record<WaterStatus, number> = { safe: 100, caution: 50, unsafe: 0 };
export const LITTER_POINTS: Record<LitterLevel, number> = { low: 100, medium: 50, high: 0 };

export const WATER_WEIGHT = 0.5;
export const LITTER_WEIGHT = 0.5;

/** Unsafe water overrides everything: the zone is capped into the Avoid band. */
export const UNSAFE_WATER_SCORE_CAP = 25;

/** Days since the last cleanup post before litter worsens. */
export const LITTER_MEDIUM_AFTER_DAYS = 7;
export const LITTER_HIGH_AFTER_DAYS = 14;

/**
 * Bands, highest first. Colors step down in lightness as well as hue so the
 * scale still reads with red-green color blindness. These four colors are
 * reserved for the cleanliness scale and must not be used elsewhere in the UI.
 */
export const BANDS: { band: Band; min: number; label: string; color: string; textOn: string }[] = [
  { band: "clean", min: 76, label: "Clean", color: "#A6F0BC", textOn: "#06281A" },
  { band: "fair", min: 51, label: "Fair", color: "#EBC034", textOn: "#2B2100" },
  { band: "poor", min: 26, label: "Poor", color: "#E07B2E", textOn: "#2A1000" },
  { band: "avoid", min: 0, label: "Avoid", color: "#9E1B1B", textOn: "#FFFFFF" },
];

export const WATER_LABELS: Record<WaterStatus, string> = { safe: "Safe", caution: "Caution", unsafe: "Unsafe" };
export const LITTER_LABELS: Record<LitterLevel, string> = { low: "Low", medium: "Medium", high: "High" };
export const LITTER_PHRASES: Record<LitterLevel, string> = {
  low: "little litter",
  medium: "some litter",
  high: "heavy litter",
};
export const SOURCE_LABELS: Record<DataSource, string> = {
  demo: "Demo data",
  official: "Official reading",
  model: "Forecast",
  volunteer: "Volunteer report",
};
