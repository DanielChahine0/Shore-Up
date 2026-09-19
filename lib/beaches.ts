import "server-only";
import { bbox } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import beachesJson from "@/data/geo/beaches.json";
import zonesJson from "@/data/geo/zones.json";

export type BeachSummary = {
  id: string;
  name: string;
  area: string;
  country: string;
  lng: number;
  lat: number;
  /** [west, south, east, north], so the camera can fly before the geometry loads. */
  bounds: [number, number, number, number];
};

type Shape = Feature<Polygon | MultiPolygon>;

const beaches = (beachesJson as unknown as FeatureCollection).features as Shape[];
const zones = (zonesJson as unknown as FeatureCollection).features as Shape[];

/** Lightweight list for globe dots and search. Geometry is fetched per beach on selection. */
const summaries: BeachSummary[] = beaches.map((f) => {
  const { id, name, area, country, lng, lat } = f.properties as BeachSummary;
  const [w, s, e, n] = bbox(f);
  return { id, name, area, country, lng, lat, bounds: [w, s, e, n] };
});

export function listBeaches(): BeachSummary[] {
  return summaries;
}

export function getBeach(id: string): BeachSummary | undefined {
  return listBeaches().find((b) => b.id === id);
}

/** All outlines with only an id, for the map's sand layer. */
export function listBeachShapes(): FeatureCollection<Polygon | MultiPolygon> {
  return { type: "FeatureCollection", features: beaches.map((f) => ({ type: "Feature", properties: { id: f.properties?.id }, geometry: f.geometry })) };
}

export function getBeachShape(id: string): Shape | undefined {
  return beaches.find((f) => f.properties?.id === id);
}

export function getZoneShapes(beachId: string): Shape[] {
  return zones.filter((f) => f.properties?.beach_id === beachId);
}
