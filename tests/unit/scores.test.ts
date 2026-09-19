import { describe, expect, it } from "vitest";
import { bandFor, beachScore, litterLevelFor, zoneScore } from "@/lib/scores/compute";
import { beachReason } from "@/lib/scores/reason";
import { scoreZone } from "@/lib/scores/scoreZone";
import type { ZoneState } from "@/lib/scores/types";

const NOW = new Date("2026-09-19T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function state(overrides: Partial<ZoneState>): ZoneState {
  return {
    zoneId: "woodbine-1",
    beachId: "woodbine",
    name: "Zone A",
    position: 1,
    waterStatus: "safe",
    waterSource: "demo",
    waterObservedAt: daysAgo(0),
    lastCleanedAt: daysAgo(1),
    litterSource: "demo",
    ...overrides,
  };
}

describe("zone score", () => {
  it("is half water, half litter", () => {
    expect(zoneScore("safe", "low")).toBe(100);
    expect(zoneScore("safe", "medium")).toBe(75);
    expect(zoneScore("caution", "medium")).toBe(50);
    expect(zoneScore("safe", "high")).toBe(50);
    expect(zoneScore("caution", "high")).toBe(25);
  });

  it("caps unsafe water into the Avoid band however clean the sand is", () => {
    expect(zoneScore("unsafe", "low")).toBe(25);
    expect(bandFor(zoneScore("unsafe", "low")).band).toBe("avoid");
    expect(zoneScore("unsafe", "high")).toBe(0);
  });

  it("maps scores to bands at the documented edges", () => {
    expect(bandFor(100).band).toBe("clean");
    expect(bandFor(76).band).toBe("clean");
    expect(bandFor(75).band).toBe("fair");
    expect(bandFor(51).band).toBe("fair");
    expect(bandFor(50).band).toBe("poor");
    expect(bandFor(26).band).toBe("poor");
    expect(bandFor(25).band).toBe("avoid");
    expect(bandFor(0).band).toBe("avoid");
  });
});

describe("litter decay", () => {
  it("is low after a cleanup, medium after 7 days, high after 14", () => {
    expect(litterLevelFor(daysAgo(0), NOW)).toBe("low");
    expect(litterLevelFor(daysAgo(6), NOW)).toBe("low");
    expect(litterLevelFor(daysAgo(7), NOW)).toBe("medium");
    expect(litterLevelFor(daysAgo(13), NOW)).toBe("medium");
    expect(litterLevelFor(daysAgo(14), NOW)).toBe("high");
  });
});

describe("scoreZone", () => {
  it("describes the demo's orange zone in plain words", () => {
    const zone = scoreZone(state({ lastCleanedAt: daysAgo(14) }), NOW);
    expect(zone.score).toBe(50);
    expect(zone.summary).toBe("Poor: heavy litter, last cleaned 14 days ago");
  });

  it("flags the unsafe override", () => {
    const zone = scoreZone(state({ waterStatus: "unsafe" }), NOW);
    expect(zone.unsafeOverride).toBe(true);
    expect(zone.label).toBe("Avoid");
    expect(zone.summary).toContain("water is unsafe");
  });

  it("turns a zone green again after a fresh cleanup", () => {
    expect(scoreZone(state({ lastCleanedAt: daysAgo(14) }), NOW).band).toBe("poor");
    expect(scoreZone(state({ lastCleanedAt: daysAgo(0), litterSource: "volunteer" }), NOW).band).toBe("clean");
  });
});

describe("beach score and reason", () => {
  it("averages zones", () => {
    expect(beachScore([100, 100, 50, 25])).toBe(69);
    expect(beachScore([])).toBe(0);
  });

  it("explains a mixed beach", () => {
    const zones = [
      scoreZone(state({}), NOW),
      scoreZone(state({ zoneId: "woodbine-2", name: "Zone B", position: 2, lastCleanedAt: daysAgo(14) }), NOW),
      scoreZone(state({ zoneId: "woodbine-3", name: "Zone C", position: 3, waterStatus: "unsafe" }), NOW),
    ];
    const reason = beachReason(zones);
    expect(reason).toContain("1 of 3 zones are clean.");
    expect(reason).toContain("Zone C shows red because the water is unsafe");
    expect(reason).toContain("Zone B has heavy litter");
  });
});

describe("demo source timing", () => {
  it("measures relative demo ages against the caller's instant, so day counts are exact", async () => {
    const { demoFileSource } = await import("@/lib/scores/sources");
    const at = new Date("2026-09-19T12:00:00.000Z");
    const zones = await demoFileSource.getZoneStates("woodbine", at);
    const zoneC = zones.find((z) => z.position === 3)!;
    // Exactly 14 days, not 13.999: the band depends on it.
    expect(at.getTime() - new Date(zoneC.lastCleanedAt).getTime()).toBe(14 * 86_400_000);
    expect(scoreZone(zoneC, at).summary).toBe("Poor: heavy litter, last cleaned 14 days ago");
  });
});

describe("official water readings", () => {
  const at = new Date("2026-09-19T12:00:00.000Z");

  it("replace the demo water value for a zone, keeping the authority's own observation time", async () => {
    const { demoFileSource } = await import("@/lib/scores/sources");
    const { default: official } = await import("@/data/seed/water-official.json");
    const reading = official.find((r) => r.authority === "toronto")!;
    const zones = await demoFileSource.getZoneStates(reading.beachId, at);
    const zone = zones.find((z) => z.zoneId === reading.zoneId)!;
    expect(zone.waterSource).toBe("official");
    expect(zone.waterStatus).toBe(reading.waterStatus);
    expect(zone.waterObservedAt).toBe(reading.observedAt);
    // Litter has no official source, so it stays demo until a volunteer posts a cleanup.
    expect(zone.litterSource).toBe("demo");
  });

  it("leave Woodbine on its hand-set demo zones", async () => {
    const { demoFileSource } = await import("@/lib/scores/sources");
    const zones = await demoFileSource.getZoneStates("woodbine", at);
    expect(zones.every((z) => z.waterSource === "demo")).toBe(true);
  });
});
