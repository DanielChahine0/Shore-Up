/**
 * Seed script: pulls beach polygons from OpenStreetMap (Overpass API, natural=beach),
 * splits each into zones along its length, and writes GeoJSON to data/geo/.
 *
 * Beaches come from two places: the hand-picked list in data/beaches.seed.json, and every
 * beach an official water quality programme samples (scripts/official/). The latest official
 * reading for each zone is written to data/seed/water-official.json.
 *
 * Usage: pnpm fetch:beaches
 * Map data (c) OpenStreetMap contributors, ODbL. Water quality sources are credited in scripts/official/.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { area as turfArea, centerOfMass, distance, featureCollection, truncate, union } from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import osmtogeojson from "osmtogeojson";
import { splitZones, type BeachShape } from "../lib/geo/splitZones";
import type { OfficialReading } from "../lib/scores/sources";
import { discoverBeaches, isArea, isLocated, sitesOn, type Candidate, type LocatedSite } from "./official/discover";
import { eeaSites } from "./official/eea";
import { nswSites } from "./official/nsw";
import { torontoSites } from "./official/toronto";
import type { MonitoredSite } from "./official/types";

type SeedBeach = { id: string; name: string; area: string; country: string; place: string; match: string; union?: boolean };

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache/osm");
const OUT_DIR = path.join(ROOT, "data/geo");
const USER_AGENT = "ShoreUp-seed/0.1 (one-time beach polygon import)";
const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const BBOX_PAD_DEG = 0.02;
const NAME_TAGS = ["name", "name:en", "alt_name", "official_name", "loc_name"];
/** Discovered beaches shorter than this are coves too small to split into meaningful zones. */
const MIN_DISCOVERED_LENGTH_M = 250;
/** How many discovered beaches to keep, so no one coastline crowds out the rest of the globe. */
const KEEP_PER_EU_COUNTRY = 20;
const KEEP_NSW = 80;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
/** Accents folded to plain letters, so "Praia da Falésia" becomes "praia-da-falesia". */
const idSlug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    const value = await load();
    await writeFile(file, JSON.stringify(value));
    return value;
  }
}

/** [south, west, north, east] for a place name, from Nominatim. */
async function placeBbox(place: string): Promise<[number, number, number, number] | null> {
  return cached(`place-${slug(place)}`, async () => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Nominatim ${res.status} for ${place}`);
    await sleep(1100);
    const [hit] = (await res.json()) as { boundingbox: [string, string, string, string] }[];
    if (!hit) return null;
    const [s, n, w, e] = hit.boundingbox.map(Number);
    return [s - BBOX_PAD_DEG, w - BBOX_PAD_DEG, n + BBOX_PAD_DEG, e + BBOX_PAD_DEG];
  });
}

async function namedBeachesIn(place: string, bbox: [number, number, number, number]): Promise<FeatureCollection> {
  return cached(`beaches-${slug(place)}`, async () => {
    const query = `[out:json][timeout:90];(way["natural"="beach"]["name"](${bbox.join(",")});relation["natural"="beach"]["name"](${bbox.join(",")}););out body;>;out skel qt;`;
    let lastError: unknown;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      for (let attempt = 0; attempt < 3; attempt++) {
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
          await sleep(5000 * (attempt + 1));
        }
      }
    }
    throw lastError;
  });
}

/** Town or city and country for a point, in English, from Nominatim. */
async function placeOf(key: string, lng: number, lat: number): Promise<{ area: string; country: string } | null> {
  return cached(`reverse16-${key}`, async () => {
    // Street level: at city level a beach often resolves to nothing but its state, or to a sea zone.
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Nominatim ${res.status} for ${key}`);
    await sleep(1100);
    const { address: a } = (await res.json()) as { address?: Record<string, string> };
    const area = a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.suburb ?? a?.county ?? a?.state;
    return area && a?.country ? { area, country: a.country } : null;
  });
}

/** Most sites first (authorities put several sampling points on their busiest beaches), then the largest. */
function busiest(candidates: Candidate[], keep: number): Candidate[] {
  return [...candidates].sort((a, b) => b.sites.length - a.sites.length || b.areaM2 - a.areaM2).slice(0, keep);
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const seeds = JSON.parse(await readFile(path.join(ROOT, "data/beaches.seed.json"), "utf8")) as SeedBeach[];

  const beaches: Feature[] = [];
  const zones: Feature[] = [];
  const readings: OfficialReading[] = [];
  const skipped: string[] = [];
  const usedOsmIds = new Set<string>();
  const skip = (id: string, why: string) => {
    skipped.push(`${id}: ${why}`);
    console.warn(`  skipped ${id}: ${why}`);
  };

  /** Splits the shape and records the beach with its zones. Returns the zones, or null when it cannot be split. */
  const addBeach = (p: { id: string; name: string; area: string; country: string; osm_name: string; osm_id: string }, shape: BeachShape, minLengthM = 0) => {
    const split = splitZones(shape);
    if (split.zones.length < 3) return skip(p.id, `polygon only split into ${split.zones.length} zones`), null;
    if (split.lengthM < minLengthM) return skip(p.id, `only ${Math.round(split.lengthM)} m long`), null;

    const [lng, lat] = centerOfMass(shape).geometry.coordinates;
    beaches.push({
      type: "Feature",
      properties: { ...p, lng: Number(lng.toFixed(6)), lat: Number(lat.toFixed(6)), length_m: Math.round(split.lengthM) },
      geometry: shape.geometry,
    });
    const added = split.zones.map((zone, i) => ({
      type: "Feature" as const,
      properties: { id: `${p.id}-${i + 1}`, beach_id: p.id, name: `Zone ${String.fromCharCode(65 + i)}`, position: i + 1 },
      geometry: zone.geometry,
    }));
    zones.push(...added);
    p.osm_id.split(",").forEach((id) => usedOsmIds.add(id));
    console.log(`  ok: ${p.id}, ${split.zones.length} zones, ${Math.round(split.lengthM)} m`);
    return added;
  };

  /** Each zone takes the reading of the sampling point nearest to it. */
  const record = (beachZones: Feature[], sites: MonitoredSite[]) => {
    for (const zone of beachZones) {
      const centre = centerOfMass(zone);
      const site = sites.length === 1 || !isLocated(sites[0])
        ? sites[0]
        : [...sites].filter(isLocated).sort((a, b) => distance(centre, [a.lng, a.lat]) - distance(centre, [b.lng, b.lat]))[0];
      readings.push({
        zoneId: String(zone.properties?.id),
        beachId: String(zone.properties?.beach_id),
        waterStatus: site.status,
        observedAt: site.observedAt,
        authority: site.authority,
        siteId: site.siteId,
        siteName: site.name,
        detail: site.detail,
      });
    }
  };

  // 1. Hand-picked beaches, found by name inside their city.
  for (const seed of seeds) {
    console.log(seed.name);
    let candidates: FeatureCollection;
    try {
      const bbox = await placeBbox(seed.place);
      if (!bbox) {
        skip(seed.id, `place not found: ${seed.place}`);
        continue;
      }
      candidates = await namedBeachesIn(seed.place, bbox);
    } catch (err) {
      skip(seed.id, `fetch failed: ${(err as Error).message}`);
      continue;
    }

    const pattern = new RegExp(seed.match, "i");
    const matches = candidates.features
      .filter(isArea)
      .filter((f) => NAME_TAGS.some((tag) => pattern.test(String(f.properties?.[tag] ?? ""))))
      .sort((a, b) => turfArea(b) - turfArea(a));
    // Some beaches are mapped as adjacent pieces (Kew + Balmy); "union" merges every match.
    const shape = (seed.union && matches.length > 1 ? union(featureCollection(matches)) : matches[0]) as BeachShape | undefined | null;
    if (!shape) {
      skip(seed.id, "no natural=beach polygon with a matching name");
      continue;
    }
    addBeach(
      {
        id: seed.id,
        name: seed.name,
        area: seed.area,
        country: seed.country,
        osm_name: String(matches[0].properties?.name ?? ""),
        osm_id: (seed.union ? matches : matches.slice(0, 1)).map((m) => String(m.id)).join(","),
      },
      shape,
    );
  }

  // 2. Official water quality for the beaches above, by id where the feed has no coordinates, otherwise by position.
  console.log("\nOfficial water quality");
  const now = new Date();
  // Never cached: a rerun is how the readings are refreshed.
  const [toronto, nsw, eea] = await Promise.all([torontoSites(now), nswSites(), eeaSites()]);
  console.log(`  ${toronto.length} Toronto, ${nsw.length} NSW, ${eea.length} EU monitoring sites`);
  const located = [...nsw, ...eea].filter(isLocated);
  for (const beach of beaches) {
    const id = String(beach.properties?.id);
    const named = toronto.filter((t) => t.beachId === id);
    const sites = named.length ? named : sitesOn(beach as BeachShape, located);
    if (sites.length) record(zones.filter((z) => z.properties?.beach_id === id), sites);
  }

  // 3. Every other beach those programmes sample, as far as OpenStreetMap has a named polygon for it.
  const nswFound = await discoverBeaches(nsw.filter(isLocated), cached, "nsw");
  const eeaFound = await discoverBeaches(eea.filter(isLocated), cached, "eea");
  const byCountry = new Map<string, Candidate[]>();
  for (const c of eeaFound) {
    const code = c.sites[0].siteId.slice(0, 2);
    byCountry.set(code, [...(byCountry.get(code) ?? []), c]);
  }
  // Extra candidates ride along so a beach that turns out too short still leaves its country a full share.
  const shortlist = (found: Candidate[], keep: number) => busiest(found.filter((c) => !usedOsmIds.has(String(c.shape.id))), keep * 2).map((c) => ({ c, keep }));
  const groups = [shortlist(nswFound, KEEP_NSW), ...[...byCountry.values()].map((found) => shortlist(found, KEEP_PER_EU_COUNTRY))];

  const ids = new Set(beaches.map((b) => String(b.properties?.id)));
  for (const group of groups) {
    let kept = 0;
    for (const { c, keep } of group) {
      if (kept >= keep) break;
      const osmId = String(c.shape.id);
      if (usedOsmIds.has(osmId)) continue;
      const tags = c.shape.properties ?? {};
      const name = String(tags["name:en"] ?? tags.int_name ?? tags.name);
      // A hotel's private strip of sand is mapped as a beach too, but it is not one anybody can clean.
      if (/^h[oô]tel\b/i.test(name)) continue;
      const [lng, lat] = centerOfMass(c.shape).geometry.coordinates;
      let place: { area: string; country: string } | null;
      try {
        place = await placeOf(idSlug(osmId), lng, lat);
      } catch (err) {
        skip(osmId, `reverse geocode failed: ${(err as Error).message}`);
        continue;
      }
      if (!place) {
        skip(osmId, `no town or country for ${name}`);
        continue;
      }
      const base = [idSlug(name) || idSlug(`${c.sites[0].authority}-${c.sites[0].siteId}`), idSlug(place.area)].filter(Boolean).join("-");
      let id = base;
      for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

      const added = addBeach({ id, name, area: place.area, country: place.country, osm_name: String(tags.name ?? ""), osm_id: osmId }, c.shape, MIN_DISCOVERED_LENGTH_M);
      if (!added) continue;
      ids.add(id);
      record(added, c.sites as LocatedSite[]);
      kept++;
    }
  }

  const write = (name: string, features: Feature[]) =>
    writeFile(
      path.join(OUT_DIR, name),
      JSON.stringify(truncate({ type: "FeatureCollection", features } as FeatureCollection, { precision: 6, coordinates: 2 })),
    );
  await write("beaches.json", beaches);
  await write("zones.json", zones);
  await writeFile(path.join(OUT_DIR, "skipped.log"), skipped.join("\n") + (skipped.length ? "\n" : ""));
  await writeFile(path.join(ROOT, "data/seed/water-official.json"), JSON.stringify(readings, null, 1) + "\n");
  const measured = new Set(readings.map((r) => r.beachId)).size;
  console.log(`\n${beaches.length} beaches (${measured} with official water quality), ${zones.length} zones, ${skipped.length} skipped (see data/geo/skipped.log)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
