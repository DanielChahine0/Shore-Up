import { area, booleanPointInPolygon, centroid, polygon } from "@turf/turf";
import { describe, expect, it } from "vitest";
import { splitZones, zoneCountForLength } from "@/lib/geo/splitZones";

// A thin strip about 1 km long, tilted so the long axis is not aligned to the grid.
const tilted = polygon([
  [
    [-79.31, 43.66],
    [-79.299, 43.664],
    [-79.2992, 43.6644],
    [-79.3102, 43.6604],
    [-79.31, 43.66],
  ],
]);

describe("splitZones", () => {
  it("scales zone count with length, between 3 and 8", () => {
    expect(zoneCountForLength(80)).toBe(3);
    expect(zoneCountForLength(750)).toBe(5);
    expect(zoneCountForLength(10_000)).toBe(8);
  });

  it("covers the whole beach with zones ordered west to east", () => {
    const { zones, lengthM } = splitZones(tilted);
    expect(lengthM).toBeGreaterThan(900);
    expect(lengthM).toBeLessThan(1100);
    expect(zones).toHaveLength(7);

    const total = zones.reduce((sum, z) => sum + area(z), 0);
    expect(total / area(tilted)).toBeCloseTo(1, 2);

    const lngs = zones.map((z) => centroid(z).geometry.coordinates[0]);
    expect([...lngs].sort((a, b) => a - b)).toEqual(lngs);
    zones.forEach((z) => expect(booleanPointInPolygon(centroid(z), tilted)).toBe(true));
  });

  it("gives each zone a similar share of the length", () => {
    const { zones } = splitZones(tilted);
    const areas = zones.map((z) => area(z));
    expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(1.6);
  });
});
