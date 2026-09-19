"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EventsResponse } from "@/app/api/events/route";
import { CloseIcon } from "@/components/ui/icons";
import { rankEvents, type EventItem, type RankedEvent } from "@/lib/cleanups/rank";
import { roundCoord } from "@/lib/geo/round";
import { useHomePlace } from "@/lib/place/usePlace";
import { EventCard } from "./EventCard";
import { CalendarIcon, CrosshairIcon } from "./icons";

export type EventsMenuProps = {
  signedIn: boolean;
  onPickBeach: (beachId: string) => void;
  onToast: (message: string) => void;
};

const DESKTOP_QUERY = "(min-width: 640px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/** Left side panel listing public cleanups near the visitor's chosen place. */
export function EventsMenu({ signedIn, onPickBeach, onToast }: EventsMenuProps) {
  const isDesktop = useIsDesktop();
  const { place, setPlace } = useHomePlace();

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const requested = useRef(false);
  const wasOpen = useRef(false);

  const load = useCallback(() => {
    requested.current = true;
    setLoading(true);
    setError(null);
    fetch("/api/events")
      .then(async (res) => {
        if (!res.ok) throw new Error("The events list didn't load.");
        return (await res.json()) as EventsResponse;
      })
      .then((data) => setEvents(data.events))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open && !requested.current) load();
  }, [open, load]);

  /** Closing resets the slide, so the next open animates in from the left again. */
  const close = useCallback(() => {
    setOpen(false);
    setShown(false);
  }, []);

  // Slide in from the left once mounted. Reduced motion zeroes the transition in globals.css.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Escape closes from anywhere, since the map behind the panel stays usable.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Opening moves focus into the panel; closing hands it back to the toggle.
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const { near, far } = useMemo(() => rankEvents(events ?? [], place), [events, place]);

  /** Keeps a card's count honest while the registration saves, and puts it back if it fails. */
  const onRegisteredChange = useCallback((id: string, registered: boolean) => {
    setEvents((current) =>
      (current ?? []).map((event) =>
        event.id === id ? { ...event, registered, attendeeCount: Math.max(0, event.attendeeCount + (registered ? 1 : -1)) } : event,
      ),
    );
  }, []);

  const pickBeach = useCallback(
    (beachId: string) => {
      onPickBeach(beachId);
      // On a phone the panel covers the map it just moved, so get out of the way.
      if (!isDesktop) close();
    },
    [close, isDesktop, onPickBeach],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeoError("This browser can't share a location.");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => setPlace({ name: "Near me", lat: roundCoord(position.coords.latitude), lng: roundCoord(position.coords.longitude) }),
      () => setGeoError("We couldn't get your location. Search for a place instead."),
    );
  };

  const emptyCopy = place ? `No cleanups planned near ${place.name} yet. Host one from any beach.` : "No cleanups planned yet. Host one from any beach.";

  const renderCard = (event: RankedEvent) => (
    <EventCard key={event.id} event={event} signedIn={signedIn} onPickBeach={pickBeach} onRegisteredChange={onRegisteredChange} onToast={onToast} />
  );

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="events-panel"
        className={`glass absolute left-4 top-[212px] z-10 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink sm:top-[132px] ${open ? "hidden" : ""}`}
      >
        <CalendarIcon className="h-[18px] w-[18px] text-brand-strong" />
        Events
      </button>

      {open && (
        <aside
          id="events-panel"
          ref={panelRef}
          tabIndex={-1}
          aria-label="Cleanup events near you"
          // Unlike the other panels this one runs the full height, over the logo and search bar
          // rather than only the map, so it is fully opaque: glass-panel's last 3% let them ghost through.
          style={{ background: "var(--color-surface)" }}
          className={`glass glass-panel absolute bottom-0 left-0 top-0 z-20 flex w-[calc(100%-2rem)] max-w-[360px] flex-col transition-transform duration-300 ease-out sm:w-[360px] ${shown ? "translate-x-0" : "-translate-x-full"}`}
        >
          <header className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Events</h2>
              <p className="text-sm text-ink-soft">{place ? `Shore cleanups near ${place.name}` : "Shore cleanups anyone can join"}</p>
            </div>
            <button type="button" onClick={close} aria-label="Close events" className="-mr-1.5 rounded-full p-1.5 text-ink-soft hover:text-ink">
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>

          {!place && (
            <div className="px-5 pt-4">
              <button
                type="button"
                onClick={useMyLocation}
                className="flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium text-ink hover:border-brand-strong/60"
              >
                <CrosshairIcon className="h-[18px] w-[18px] text-brand-strong" />
                Use my location
              </button>
              <p className="mt-2 text-xs text-ink-soft">It stays in this browser, rounded to about 11 km.</p>
              {geoError && (
                <p role="alert" className="mt-2 text-xs text-ink">
                  {geoError}
                </p>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4">
            {loading && <p className="text-sm text-ink-soft">Loading cleanups near you.</p>}

            {error && (
              <div className="rounded-2xl border border-line p-4 text-sm text-ink">
                <p role="alert">{error}</p>
                <button type="button" onClick={load} className="mt-3 h-11 rounded-full bg-brand-strong px-4 text-sm font-semibold text-white">
                  Try again
                </button>
              </div>
            )}

            {events && !loading && !error && (
              <>
                {near.length === 0 ? <p className="text-sm text-ink-soft">{emptyCopy}</p> : <ul className="grid gap-3">{near.map(renderCard)}</ul>}

                {far.length > 0 && (
                  <>
                    <h3 className="mb-3 mt-6 text-sm font-semibold text-ink">Further away</h3>
                    <ul className="grid gap-3">{far.map(renderCard)}</ul>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
