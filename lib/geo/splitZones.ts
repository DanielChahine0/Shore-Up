import { centroid, convex, featureCollection, intersect, polygon as turfPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

export type BeachShape = Feature<Polygon | MultiPolygon>;

export const ZONE_TARGET_LENGTH_M = 150;
export const MIN_ZONES = 3;
export const MAX_ZONES = 8;

const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG_AT_EQUATOR = 111_320;

export function zoneCountForLength(lengthM: number): number {
  return Math.min(MAX_ZONES, Math.max(MIN_ZONES, Math.round(lengthM / ZONE_TARGET_LENGTH_M)));
}

/**
 * Splits a beach into zones along its length. The long axis comes from the
 * minimum-area rotated bounding box of the shape's convex hull; zones are
 * equal-length strips perpendicular to it, clipped to the beach polygon.
 * Zones are ordered west to east, or south to north for north-south beaches.
 */
export function splitZones(shape: BeachShape): { zones: BeachShape[]; lengthM: number } {
  const [lng0, lat0] = centroid(shape).geometry.coordinates;
  const mPerDegLng = M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const toLocal = ([lng, lat]: Position): [number, number] => [(lng - lng0) * mPerDegLng, (lat - lat0) * M_PER_DEG_LAT];
  const toLngLat = ([x, y]: [number, number]): Position => [lng0 + x / mPerDegLng, lat0 + y / M_PER_DEG_LAT];

  const hull = convex(shape);
  if (!hull) return { zones: [], lengthM: 0 };
  const pts = hull.geometry.coordinates[0].map(toLocal);

  let axis = 0;
  let bestArea = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const theta = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    const { uMin, uMax, vMin, vMax } = extent(pts, theta);
    const w = uMax - uMin;
    const h = vMax - vMin;
    if (w * h < bestArea) {
      bestArea = w * h;
      axis = w >= h ? theta : theta + Math.PI / 2;
    }
  }
  // Point the axis east (or north when the beach runs north-south) so zone order is stable.
  const [dx, dy] = [Math.cos(axis), Math.sin(axis)];
  if (Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0) axis += Math.PI;

  const { uMin, uMax, vMin, vMax } = extent(pts, axis);
  const lengthM = uMax - uMin;
  const n = zoneCountForLength(lengthM);
  const pad = 10;
  const cos = Math.cos(axis);
  const sin = Math.sin(axis);
  const fromAxis = (u: number, v: number): Position => toLngLat([u * cos - v * sin, u * sin + v * cos]);

  const zones: BeachShape[] = [];
  for (let i = 0; i < n; i++) {
    const a = uMin + (lengthM * i) / n - (i === 0 ? pad : 0);
    const b = uMin + (lengthM * (i + 1)) / n + (i === n - 1 ? pad : 0);
    const strip = turfPolygon([
      [fromAxis(a, vMin - pad), fromAxis(b, vMin - pad), fromAxis(b, vMax + pad), fromAxis(a, vMax + pad), fromAxis(a, vMin - pad)],
    ]);
    const piece = intersect(featureCollection<Polygon | MultiPolygon>([shape, strip]));
    if (piece) zones.push(piece);
  }
  return { zones, lengthM };
}

function extent(pts: [number, number][], angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const [x, y] of pts) {
    const u = x * cos + y * sin;
    const v = -x * sin + y * cos;
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
  return { uMin, uMax, vMin, vMax };
}
