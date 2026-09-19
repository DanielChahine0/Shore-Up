import type { PlaceResult } from "@/components/chrome/SearchBar";

/**
 * Place-like types only. A street address must never become someone's home place:
 * the point of the rounded home place is that it says "roughly here", not "this door".
 */
const TYPES = "place,locality,neighborhood,district,region";

export const MAX_SUGGESTIONS = 5;

type Feature = {
  id?: unknown;
  geometry?: { coordinates?: unknown };
  properties?: { name?: unknown; place_formatted?: unknown; bbox?: unknown };
};

const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

const isBox = (v: unknown): v is [number, number, number, number] => Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && Number.isFinite(n));

export function geocodeUrl(query: string, token: string): string {
  return `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query.trim())}&limit=${MAX_SUGGESTIONS}&types=${TYPES}&access_token=${token}`;
}

/** Keeps only the features the globe can fly to, so a malformed response degrades to no suggestions. */
export function parsePlaces(body: unknown): PlaceResult[] {
  const features = (body as { features?: unknown } | null | undefined)?.features;
  if (!Array.isArray(features)) return [];
  const places: PlaceResult[] = [];
  for (const feature of features as Feature[]) {
    const name = feature?.properties?.name;
    const center = feature?.geometry?.coordinates;
    if (typeof name !== "string" || name === "" || !isPair(center)) continue;
    const context = feature.properties?.place_formatted;
    const bbox = feature.properties?.bbox;
    places.push({
      id: typeof feature.id === "string" ? feature.id : `${name}-${center.join(",")}`,
      name,
      context: typeof context === "string" ? context : "",
      center,
      ...(isBox(bbox) ? { bounds: bbox } : {}),
    });
    if (places.length === MAX_SUGGESTIONS) break;
  }
  return places;
}

export async function geocodePlaces(query: string, token: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const res = await fetch(geocodeUrl(query, token), { signal });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  return parsePlaces(await res.json());
}
