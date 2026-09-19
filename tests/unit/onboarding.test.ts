import { describe, expect, it } from "vitest";
import { MAX_SUGGESTIONS, geocodeUrl, parsePlaces } from "@/lib/place/geocode";

const feature = (name: string, coordinates: unknown, extra: Record<string, unknown> = {}) => ({
  id: `dXJuOm${name}`,
  geometry: { coordinates },
  properties: { name, ...extra },
});

describe("geocodeUrl", () => {
  const url = geocodeUrl("  Toronto  ", "pk.test");

  it("asks for place-like types only, so no street address can be saved", () => {
    const types = new URL(url).searchParams.get("types")?.split(",") ?? [];
    expect(types).toEqual(["place", "locality", "neighborhood", "district", "region"]);
    expect(types).not.toContain("address");
    expect(types).not.toContain("street");
  });

  it("trims and escapes the query and caps the suggestions", () => {
    const params = new URL(url).searchParams;
    expect(params.get("q")).toBe("Toronto");
    expect(params.get("limit")).toBe(String(MAX_SUGGESTIONS));
    expect(params.get("access_token")).toBe("pk.test");
    expect(geocodeUrl("Saint-Jean sur Mer & co", "pk.test")).toContain("q=Saint-Jean%20sur%20Mer%20%26%20co");
  });
});

describe("parsePlaces", () => {
  it("reads name, context, center, and bounds", () => {
    expect(parsePlaces({ features: [feature("Toronto", [-79.4, 43.7], { place_formatted: "Ontario, Canada", bbox: [-79.6, 43.5, -79.1, 43.9] })] })).toEqual([
      { id: "dXJuOmToronto", name: "Toronto", context: "Ontario, Canada", center: [-79.4, 43.7], bounds: [-79.6, 43.5, -79.1, 43.9] },
    ]);
  });

  it("leaves bounds off when the response has none, and context empty", () => {
    const [place] = parsePlaces({ features: [feature("Tofino", [-125.9, 49.1])] });
    expect(place.context).toBe("");
    expect("bounds" in place).toBe(false);
  });

  it("drops features that cannot be flown to", () => {
    const body = {
      features: [
        feature("Toronto", [-79.4, 43.7]),
        feature("No coordinates", undefined),
        feature("Half a pair", [-79.4]),
        feature("Not numbers", ["-79.4", "43.7"]),
        { geometry: { coordinates: [1, 2] }, properties: {} },
      ],
    };
    expect(parsePlaces(body).map((p) => p.name)).toEqual(["Toronto"]);
  });

  it("ignores a bbox that is not four numbers", () => {
    const [place] = parsePlaces({ features: [feature("Toronto", [-79.4, 43.7], { bbox: [-79.6, 43.5] })] });
    expect("bounds" in place).toBe(false);
  });

  it("falls back to a stable id when the feature has none", () => {
    const [place] = parsePlaces({ features: [{ geometry: { coordinates: [-79.4, 43.7] }, properties: { name: "Toronto" } }] });
    expect(place.id).toBe("Toronto--79.4,43.7");
  });

  it("returns nothing for a malformed or empty response", () => {
    expect(parsePlaces(null)).toEqual([]);
    expect(parsePlaces(undefined)).toEqual([]);
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces({ features: "nope" })).toEqual([]);
    expect(parsePlaces({ features: [] })).toEqual([]);
  });

  it("never returns more than the suggestion cap", () => {
    const features = Array.from({ length: 9 }, (_, i) => feature(`Place ${i}`, [i, i]));
    expect(parsePlaces({ features })).toHaveLength(MAX_SUGGESTIONS);
  });
});
