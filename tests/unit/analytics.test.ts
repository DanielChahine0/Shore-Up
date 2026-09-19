import { describe, expect, it } from "vitest";
import { allowedProps, isAnalyticsEvent } from "@/lib/analytics/events";

describe("analytics allowlist", () => {
  it("drops properties an event may not carry, such as a location", () => {
    expect(allowedProps("welcome_completed", { as: "guest", place_method: "typed", lat: 43.6, name: "Toronto" })).toEqual({ as: "guest", place_method: "typed" });
  });

  it("drops values that are not plain scalars", () => {
    expect(allowedProps("clean_session_finished", { total_items: 12, item_types: { can: 2 } as unknown as number })).toEqual({ total_items: 12 });
  });

  it("only accepts known event names", () => {
    expect(isAnalyticsEvent("event_registered")).toBe(true);
    expect(isAnalyticsEvent("page_viewed")).toBe(false);
    expect(isAnalyticsEvent("constructor")).toBe(false);
  });
});
