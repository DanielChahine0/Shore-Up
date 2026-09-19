import type { FeatureCollection, Point } from "geojson";
import type { WaterStatus } from "../../lib/scores/config";
import { getJson, type MonitoredSite } from "./types";

/**
 * NSW Beachwatch (New South Wales Government): daily pollution forecasts and the latest
 * enterococci sample rating for every monitored swim site.
 * https://www.beachwatch.nsw.gov.au/ - Creative Commons Attribution 4.0.
 */
const ENDPOINT = "https://api.beachwatch.nsw.gov.au/public/sites/geojson";

type Props = {
  id: string;
  siteName: string;
  pollutionForecast: string;
  pollutionForecastTimeStamp: string | null;
  latestResult: string | null;
  latestResultObservationDate: string | null;
};

const FORECAST: Record<string, WaterStatus> = { Unlikely: "safe", Possible: "caution", Likely: "unsafe" };
const RESULT: Record<string, WaterStatus> = { Good: "safe", Fair: "caution", Poor: "unsafe", Bad: "unsafe" };

export async function nswSites(): Promise<MonitoredSite[]> {
  const fc = await getJson<FeatureCollection<Point, Props>>(ENDPOINT);
  const sites: MonitoredSite[] = [];
  for (const f of fc.features) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const base = { authority: "nsw-beachwatch" as const, siteId: p.id, name: p.siteName, lng, lat };
    // Today's forecast says more about today's swim than a sample from last week, so it wins when there is one.
    const forecast = FORECAST[p.pollutionForecast];
    const result = p.latestResult ? RESULT[p.latestResult] : undefined;
    if (forecast && p.pollutionForecastTimeStamp) {
      sites.push({
        ...base,
        status: forecast,
        observedAt: new Date(p.pollutionForecastTimeStamp).toISOString(),
        detail: `Pollution ${p.pollutionForecast.toLowerCase()} (Beachwatch daily forecast)`,
      });
    } else if (result && p.latestResultObservationDate) {
      sites.push({
        ...base,
        status: result,
        observedAt: new Date(p.latestResultObservationDate).toISOString(),
        detail: `${p.latestResult} (latest Beachwatch enterococci sample)`,
      });
    }
  }
  return sites;
}
