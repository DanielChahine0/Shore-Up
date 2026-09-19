/**
 * One-time seed script: pulls beach polygons from OpenStreetMap (Overpass API,
 * natural=beach), splits each into zones along its length, and writes GeoJSON
 * to data/geo/. Beaches without a polygon are skipped and logged.
 *
 * Usage: pnpm fetch:beaches
 * Data (c) OpenStreetMap contributors, ODbL.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { area as turfArea, centerOfMass, featureCollection, truncate, union } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import osmtogeojson from "osmtogeojson";
import { splitZones, type BeachShape } from "../lib/geo/splitZones";

type SeedBeach = { id: string; name: string; area: string; country: string; place: string; match: string; union?: boolean };

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache/osm");
const OUT_DIR = path.join(ROOT, "data/geo");
const USER_AGENT = "ShoreUp-seed/0.1 (one-time beach polygon import)";
const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const BBOX_PAD_DEG = 0.02;
const NAME_TAGS = ["name", "name:en", "alt_name", "official_name", "loc_name"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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

function isArea(f: Feature): f is Feature<Polygon | MultiPolygon> {
  return f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon";
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const seeds = JSON.parse(await readFile(path.join(ROOT, "data/beaches.seed.json"), "utf8")) as SeedBeach[];

  const beaches: Feature[] = [];
  const zones: Feature[] = [];
  const skipped: string[] = [];
  const skip = (seed: SeedBeach, why: string) => {
    skipped.push(`${seed.id}: ${why}`);
    console.warn(`  skipped ${seed.id}: ${why}`);
  };

  for (const seed of seeds) {
    console.log(seed.name);
    let candidates: FeatureCollection;
    try {
      const bbox = await placeBbox(seed.place);
      if (!bbox) {
        skip(seed, `place not found: ${seed.place}`);
        continue;
      }
      candidates = await namedBeachesIn(seed.place, bbox);
    } catch (err) {
      skip(seed, `fetch failed: ${(err as Error).message}`);
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
      skip(seed, "no natural=beach polygon with a matching name");
      continue;
    }

    const split = splitZones(shape);
    if (split.zones.length < 3) {
      skip(seed, `polygon only split into ${split.zones.length} zones`);
      continue;
    }

    const [lng, lat] = centerOfMass(shape).geometry.coordinates;
    beaches.push({
      type: "Feature",
      properties: {
        id: seed.id,
        name: seed.name,
        area: seed.area,
        country: seed.country,
        osm_name: String(matches[0].properties?.name ?? ""),
        osm_id: (seed.union ? matches : matches.slice(0, 1)).map((m) => String(m.id)).join(","),
        lng: Number(lng.toFixed(6)),
        lat: Number(lat.toFixed(6)),
        length_m: Math.round(split.lengthM),
      },
      geometry: shape.geometry,
    });
    split.zones.forEach((zone, i) => {
      zones.push({
        type: "Feature",
        properties: {
          id: `${seed.id}-${i + 1}`,
          beach_id: seed.id,
          name: `Zone ${String.fromCharCode(65 + i)}`,
          position: i + 1,
        },
        geometry: zone.geometry,
      });
    });
    console.log(`  ok: ${split.zones.length} zones, ${Math.round(split.lengthM)} m`);
  }

  const write = (name: string, features: Feature[]) =>
    writeFile(
      path.join(OUT_DIR, name),
      JSON.stringify(truncate({ type: "FeatureCollection", features } as FeatureCollection, { precision: 6, coordinates: 2 })),
    );
  await write("beaches.json", beaches);
  await write("zones.json", zones);
  await writeFile(path.join(OUT_DIR, "skipped.log"), skipped.join("\n") + (skipped.length ? "\n" : ""));
  console.log(`\n${beaches.length} beaches, ${zones.length} zones, ${skipped.length} skipped (see data/geo/skipped.log)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
