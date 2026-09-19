/**
 * Finds the OpenStreetMap beach polygon under each official monitoring site, so a beach
 * enters the app only when an authority actually samples its water.
 */
import { area as turfArea, bbox as turfBbox, point, pointToPolygonDistance } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import osmtogeojson from "osmtogeojson";
import { USER_AGENT, type MonitoredSite } from "./types";

export type LocatedSite = MonitoredSite & { lng: number; lat: number };
export type Shape = Feature<Polygon | MultiPolygon>;
export type Candidate = { shape: Shape; sites: LocatedSite[]; areaM2: number };

const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
/** A sampling point is usually in the water just off the sand, so it rarely sits inside the polygon itself. */
export const SITE_MATCH_M = 150;
const CELLS_PER_QUERY = 6;
/** About 300 m, so a beach whose sampling point sits on a cell's edge is still inside the box. */
const BOX_PAD_DEG = 0.003;
const M_PER_DEG = 111_320;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isArea(f: Feature): f is Shape {
  return f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon";
}

export function isLocated(site: MonitoredSite): site is LocatedSite {
  return site.lng != null && site.lat != null;
}

/** Sites within SITE_MATCH_M of the shape, nearest first. */
export function sitesOn(shape: Shape, sites: LocatedSite[]): LocatedSite[] {
  const [w, s, e, n] = turfBbox(shape);
  const padLat = SITE_MATCH_M / M_PER_DEG;
  const padLng = padLat / Math.max(0.1, Math.cos((((s + n) / 2) * Math.PI) / 180));
  return sites
    .filter((t) => t.lng >= w - padLng && t.lng <= e + padLng && t.lat >= s - padLat && t.lat <= n + padLat)
    .map((t) => ({ site: t, d: Math.max(0, pointToPolygonDistance(point([t.lng, t.lat]), shape, { units: "meters" })) }))
    .filter(({ d }) => d <= SITE_MATCH_M)
    .sort((a, b) => a.d - b.d)
    .map(({ site }) => site);
}

async function overpass(query: string): Promise<FeatureCollection> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const fc = osmtogeojson(await res.json()) as FeatureCollection;
        await sleep(2000);
        return fc;
      } catch (err) {
        lastError = err;
        console.warn(`    ${new URL(endpoint).host}: ${(err as Error).message}, retrying`);
        await sleep(8000 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

/**
 * Named natural=beach polygons with at least one monitoring site on them.
 * `cached` keeps each Overpass batch on disk, so a rerun costs nothing.
 */
export async function discoverBeaches(
  sites: LocatedSite[],
  cached: <T>(key: string, load: () => Promise<T>) => Promise<T>,
  label: string,
): Promise<Candidate[]> {
  // One tight box per 1-degree cell that has sites. Boxes hit Overpass's spatial index directly,
  // where a radius search around every single site times out.
  const cells = new Map<string, [number, number, number, number]>();
  for (const t of sites) {
    const key = `${Math.floor(t.lat)}_${Math.floor(t.lng)}`;
    const [s, w, n, e] = cells.get(key) ?? [90, 180, -90, -180];
    cells.set(key, [Math.min(s, t.lat), Math.min(w, t.lng), Math.max(n, t.lat), Math.max(e, t.lng)]);
  }
  const keys = [...cells.keys()].sort();
  const byOsmId = new Map<string, Candidate>();
  const batches = Math.ceil(keys.length / CELLS_PER_QUERY);

  for (let i = 0; i < batches; i++) {
    const batch = keys.slice(i * CELLS_PER_QUERY, (i + 1) * CELLS_PER_QUERY);
    const boxes = batch
      .map((key) => cells.get(key)!)
      .map(([s, w, n, e]) => `(${(s - BOX_PAD_DEG).toFixed(4)},${(w - BOX_PAD_DEG).toFixed(4)},${(n + BOX_PAD_DEG).toFixed(4)},${(e + BOX_PAD_DEG).toFixed(4)})`)
      .flatMap((box) => [`way["natural"="beach"]["name"]${box};`, `relation["natural"="beach"]["name"]${box};`])
      .join("");
    const fc = await cached(`discover-${label}-${batch[0]}-${batch.length}`, () => overpass(`[out:json][timeout:180];(${boxes});out body;>;out skel qt;`));
    for (const shape of fc.features.filter(isArea)) {
      const id = String(shape.id);
      if (byOsmId.has(id)) continue;
      // Matched against every site, not just this batch, so a cached batch still lines up after the site list changes.
      const matched = sitesOn(shape, sites);
      if (matched.length) byOsmId.set(id, { shape, sites: matched, areaM2: turfArea(shape) });
    }
    console.log(`  ${label}: batch ${i + 1}/${batches}, ${byOsmId.size} beaches so far`);
  }
  return [...byOsmId.values()];
}
