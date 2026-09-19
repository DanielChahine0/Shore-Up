import type { WaterStatus } from "../../lib/scores/config";
import { getJson, type MonitoredSite } from "./types";

/**
 * European Environment Agency, Bathing Water Directive status (WISE_BWD): the yearly quality
 * class every EU member state reports for each coastal bathing water, with its coordinates.
 * https://www.eea.europa.eu/en/datahub/datahubitem-view/c3858959-90da-4c1c-b7a9-3f5ae4e1c1b0
 * EEA standard re-use policy (attribution).
 */
const ENDPOINT = "https://discodata.eea.europa.eu/sql";
/** The most recent season the EEA has published. */
export const EEA_SEASON = 2024;
const PAGE = 20_000;

const STATUS: Record<string, WaterStatus> = {
  "1 - Excellent": "safe",
  "2 - Good": "safe",
  "3 - Sufficient": "caution",
  "4 - Poor": "unsafe",
};

// The service adds its own paging and rejects ORDER BY, so each query is read page by page as it comes.
async function query<T>(sql: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const url = `${ENDPOINT}?query=${encodeURIComponent(sql)}&p=${page}&nrOfHits=${PAGE}`;
    const body = await getJson<{ results?: T[]; errors?: { error: string }[] }>(url);
    if (body.errors?.length) throw new Error(`EEA: ${body.errors[0].error}`);
    rows.push(...(body.results ?? []));
    if ((body.results?.length ?? 0) < PAGE) return rows;
  }
}

export async function eeaSites(): Promise<MonitoredSite[]> {
  const waters = await query<{ id: string; quality: string; name: string; lon: number | null; lat: number | null }>(
    `SELECT a.bathingWaterIdentifier AS id, a.quality, p.nameText AS name, p.lon, p.lat
     FROM [WISE_BWD].[latest].[assessment_BathingWaterStatus] a
     JOIN [WISE_BWD].[latest].[spatial_ProtectedArea] p ON p.thematicIdIdentifier = a.bathingWaterIdentifier
     WHERE a.season = ${EEA_SEASON} AND a.specialisedZoneType = 'coastalBathingWater'`,
  );
  const samples = await query<{ id: string; lastSample: string }>(
    `SELECT m.bathingWaterIdentifier AS id, MAX(m.sampleDate) AS lastSample
     FROM [WISE_BWD].[latest].[timeseries_MonitoringResult] m
     WHERE m.season = ${EEA_SEASON} GROUP BY m.bathingWaterIdentifier`,
  );
  const lastSample = new Map(samples.map((s) => [s.id, s.lastSample]));

  const sites = new Map<string, MonitoredSite>();
  for (const w of waters) {
    const status = STATUS[w.quality];
    // "Not classified" waters have too few samples to say anything about.
    if (!status || w.lon == null || w.lat == null) continue;
    sites.set(w.id, {
      authority: "eea",
      siteId: w.id,
      name: w.name,
      lng: Number(w.lon),
      lat: Number(w.lat),
      status,
      // The class covers the whole season, so it dates from the season's last sample.
      observedAt: `${lastSample.get(w.id) ?? `${EEA_SEASON}-09-30`}T12:00:00.000Z`,
      detail: `${w.quality.slice(4)} (EU bathing water class, ${EEA_SEASON} season)`,
    });
  }
  return [...sites.values()];
}
