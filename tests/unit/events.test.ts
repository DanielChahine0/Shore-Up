import { describe, expect, it } from "vitest";
import { NEAR_RADIUS_KM, rankEvents, type EventItem } from "@/lib/cleanups/rank";

const toronto = { lat: 43.6, lng: -79.4 };

function event(id: string, over: Partial<EventItem> = {}): EventItem {
  return {
    id,
    beachId: `beach-${id}`,
    beachName: `Beach ${id}`,
    beachArea: "Toronto, Canada",
    lat: toronto.lat,
    lng: toronto.lng,
    startsAt: "2026-10-01T14:00:00.000Z",
    organizerName: "Sam",
    attendeeCount: 1,
    attendees: [],
    registered: false,
    ...over,
  };
}

describe("rankEvents", () => {
  it("puts the busiest events first, then the soonest", () => {
    const events = [
      event("quiet-soon", { attendeeCount: 2, startsAt: "2026-10-01T09:00:00.000Z" }),
      event("busy-late", { attendeeCount: 9, startsAt: "2026-12-01T09:00:00.000Z" }),
      event("busy-soon", { attendeeCount: 9, startsAt: "2026-10-02T09:00:00.000Z" }),
    ];
    expect(rankEvents(events, toronto).near.map((e) => e.id)).toEqual(["busy-soon", "busy-late", "quiet-soon"]);
  });

  it("without a place, keeps every event in one list and measures no distances", () => {
    const events = [event("a", { attendeeCount: 1 }), event("b", { attendeeCount: 4, lat: -33.9, lng: 151.2 })];
    const { near, far } = rankEvents(events, null);
    expect(near.map((e) => e.id)).toEqual(["b", "a"]);
    expect(near.every((e) => e.distanceKm === null)).toBe(true);
    expect(far).toEqual([]);
  });

  it("splits events further than the radius into their own list", () => {
    const sydney = event("sydney", { attendeeCount: 50, lat: -33.9, lng: 151.2 });
    const local = event("local", { attendeeCount: 1 });
    const { near, far } = rankEvents([sydney, local], toronto);
    expect(near.map((e) => e.id)).toEqual(["local"]);
    expect(far.map((e) => e.id)).toEqual(["sydney"]);
    expect(near[0].distanceKm).toBeCloseTo(0, 5);
    expect(far[0].distanceKm).toBeGreaterThan(NEAR_RADIUS_KM);
  });

  it("keeps an event exactly at the radius in the near list", () => {
    // One degree of latitude is about 111 km, so 0.85 degrees lands just inside 100 km.
    const edge = event("edge", { lat: toronto.lat + 0.85 });
    const { near, far } = rankEvents([edge], toronto);
    expect(near[0].distanceKm).toBeLessThanOrEqual(NEAR_RADIUS_KM);
    expect(far).toEqual([]);
  });

  it("does not reorder the array it was given", () => {
    const events = [event("a", { attendeeCount: 1 }), event("b", { attendeeCount: 5 })];
    rankEvents(events, toronto);
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
