/**
 * The only events Shore Up records, and the only properties each may carry.
 * Nothing here can hold a location, a name, or an id of a person.
 */
export const ANALYTICS_EVENTS = {
  welcome_completed: ["as", "place_method"],
  clean_session_started: ["signed_in", "at_beach"],
  clean_session_finished: ["signed_in", "total_items", "item_types", "unlocked_now"],
  event_registered: [],
  event_cancelled: [],
  events_menu_opened: ["has_place"],
} as const satisfies Record<string, readonly string[]>;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProps = Record<string, string | number | boolean>;

/** Keeps only the properties the event is allowed to carry. */
export function allowedProps(event: AnalyticsEvent, props: AnalyticsProps): AnalyticsProps {
  const allowed: readonly string[] = ANALYTICS_EVENTS[event];
  return Object.fromEntries(Object.entries(props).filter(([key, value]) => allowed.includes(key) && ["string", "number", "boolean"].includes(typeof value)));
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && Object.hasOwn(ANALYTICS_EVENTS, value);
}
