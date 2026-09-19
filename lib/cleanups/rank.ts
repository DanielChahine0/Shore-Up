import { distanceKm } from "@/lib/geo/round";

/** One public attendee in a card's avatar row. */
export type EventAttendee = { userId: string; displayName: string; avatarUrl: string | null };

/** A public cleanup as the events menu shows it. Ranking happens in the browser, so this carries coordinates. */
export type EventItem = {
  id: string;
  beachId: string;
  beachName: string;
  beachArea: string;
  lat: number;
  lng: number;
  startsAt: string;
  /** Null when the organizer's profile is not public. */
  organizerName: string | null;
  attendeeCount: number;
  /** Up to five public attendees, the ones who joined first. */
  attendees: EventAttendee[];
  registered: boolean;
};

export type RankedEvent = EventItem & { distanceKm: number | null };

/** Events this close to the visitor's place count as "in their area". */
export const NEAR_RADIUS_KM = 100;

/** Top events are the busiest ones. Ties go to whichever happens first. */
function byAttendanceThenTime(a: EventItem, b: EventItem): number {
  return b.attendeeCount - a.attendeeCount || Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

/**
 * Splits upcoming events into the ones near the visitor's place and the rest,
 * both busiest first. Without a place there is nothing to measure against, so
 * everything lands in one list and no distances are shown.
 */
export function rankEvents(events: EventItem[], place: { lat: number; lng: number } | null): { near: RankedEvent[]; far: RankedEvent[] } {
  const sorted = [...events].sort(byAttendanceThenTime);
  if (!place) return { near: sorted.map((event) => ({ ...event, distanceKm: null })), far: [] };

  const measured = sorted.map((event) => ({ ...event, distanceKm: distanceKm(place, { lat: event.lat, lng: event.lng }) }));
  return {
    near: measured.filter((event) => event.distanceKm <= NEAR_RADIUS_KM),
    far: measured.filter((event) => event.distanceKm > NEAR_RADIUS_KM),
  };
}
