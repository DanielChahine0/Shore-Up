import { getJson, type MonitoredSite } from "./types";

/**
 * City of Toronto beach water quality (Toronto Public Health, daily E. coli samples in season).
 * https://open.toronto.ca/dataset/toronto-beaches-water-quality/
 * Open Government Licence - Toronto.
 */
const ENDPOINT = "https://secure.toronto.ca/opendata/adv/beach_results/v1";
const LOOKBACK_DAYS = 120;

/**
 * The feed has no coordinates, so each of its beaches is tied to ours by name.
 * "Woodbine Beaches" is left out on purpose: Woodbine keeps its hand-set demo zones (see gen-demo-state.ts).
 */
const BEACH_IDS: Record<string, string> = {
  "Marie Curtis Park East Beach": "marie-curtis-park-east",
  "Sunnyside Beach": "sunnyside",
  "Hanlan's Point Beach": "hanlans-point",
  "Gibraltar Point Beach": "gibraltar-point",
  "Centre Island Beach": "centre-island",
  "Ward's Island Beach": "wards-island",
  "Cherry Beach": "cherry",
  "Kew Balmy Beach": "kew-balmy",
  "Bluffer's Beach Park": "bluffers-park",
};

type Day = {
  CollectionDate: string;
  data: { beachId: number; beachName: string; eColi: number | null; statusFlag: "SAFE" | "UNSAFE" | "NO_DATA" }[];
};

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function torontoSites(now: Date): Promise<MonitoredSite[]> {
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const days = await getJson<Day[]>(`${ENDPOINT}?format=json&startDate=${day(start)}&endDate=${day(now)}`);
  days.sort((a, b) => b.CollectionDate.localeCompare(a.CollectionDate));

  const latest = new Map<string, MonitoredSite>();
  for (const { CollectionDate, data } of days) {
    for (const b of data) {
      const beachId = BEACH_IDS[b.beachName];
      if (!beachId || latest.has(beachId) || b.statusFlag === "NO_DATA" || b.eColi == null) continue;
      latest.set(beachId, {
        authority: "toronto",
        siteId: String(b.beachId),
        name: b.beachName,
        beachId,
        status: b.statusFlag === "SAFE" ? "safe" : "unsafe",
        observedAt: `${CollectionDate}T12:00:00.000Z`,
        detail: `E. coli ${b.eColi} per 100 ml`,
      });
    }
  }
  return [...latest.values()];
}
