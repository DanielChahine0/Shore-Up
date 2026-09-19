import type { WaterStatus } from "../../lib/scores/config";

/**
 * One bathing water as its monitoring authority publishes it: where it is and what the
 * latest water quality result says. Nothing here is generated.
 */
export type MonitoredSite = {
  /** Which authority the reading comes from. */
  authority: "toronto" | "nsw-beachwatch" | "eea";
  /** The authority's own identifier for the site. */
  siteId: string;
  name: string;
  /** Missing when the authority publishes no coordinates; then `beachId` names the beach directly. */
  lng?: number;
  lat?: number;
  beachId?: string;
  status: WaterStatus;
  /** When the authority observed or assessed the water, ISO 8601. */
  observedAt: string;
  /** The authority's own words for the result, e.g. "E. coli 92 per 100 ml" or "Excellent (2024 season)". */
  detail: string;
};

export const USER_AGENT = "ShoreUp-seed/0.1 (one-time beach data import)";

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as T;
}
