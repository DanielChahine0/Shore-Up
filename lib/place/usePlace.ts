"use client";

import { useCallback, useSyncExternalStore } from "react";
import { roundCoord } from "@/lib/geo/round";

/**
 * The place a visitor (guest or signed in) chose to see Shore Up around.
 * It lives only in this browser, is rounded to about 11 km before it is kept,
 * and is never sent to the server.
 */
export type HomePlace = { name: string; lat: number; lng: number };

const KEY = "shoreup.place";
const EVENT = "shoreup:place";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function parse(raw: string | null): HomePlace | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HomePlace>;
    return typeof value.name === "string" && typeof value.lat === "number" && typeof value.lng === "number"
      ? { name: value.name, lat: value.lat, lng: value.lng }
      : null;
  } catch {
    return null;
  }
}

export function saveHomePlace(place: HomePlace | null) {
  try {
    if (place) window.localStorage.setItem(KEY, JSON.stringify({ name: place.name, lat: roundCoord(place.lat), lng: roundCoord(place.lng) }));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage. The place then lasts for this visit only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useHomePlace(): { place: HomePlace | null; setPlace: (place: HomePlace | null) => void } {
  // The raw string is the snapshot so it stays referentially stable between renders.
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const setPlace = useCallback((place: HomePlace | null) => saveHomePlace(place), []);
  return { place: parse(raw), setPlace };
}
