"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PinIcon, SearchIcon, WaveIcon } from "@/components/ui/icons";
import type { BeachSummary } from "@/lib/beaches";

export type PlaceResult = { id: string; name: string; context: string; center: [number, number]; bounds?: [number, number, number, number] };

type Option = { kind: "beach"; beach: BeachSummary } | { kind: "place"; place: PlaceResult };

type Props = {
  beaches: BeachSummary[];
  token: string;
  onPickBeach: (id: string) => void;
  onPickPlace: (place: PlaceResult) => void;
};

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function SearchBar({ beaches, token, onPickBeach, onPickPlace }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Geocoding results are tagged with their query so stale ones are never shown.
  const [geocoded, setGeocoded] = useState<{ q: string; places: PlaceResult[]; failed: boolean }>({ q: "", places: [], failed: false });
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = normalize(query.trim());
  const beachHits = useMemo(
    () => (q.length < 2 ? [] : beaches.filter((b) => normalize(`${b.name} ${b.area} ${b.country}`).includes(q)).slice(0, 5)),
    [beaches, q],
  );

  // Places come from Mapbox geocoding, debounced.
  useEffect(() => {
    if (q.length < 3 || !token) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query.trim())}&limit=4&types=place,locality,neighborhood,district,region,country&access_token=${token}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
        const data = (await res.json()) as {
          features: { id: string; geometry: { coordinates: [number, number] }; properties: { name: string; place_formatted?: string; bbox?: [number, number, number, number] } }[];
        };
        const places = data.features.map((f) => ({
          id: f.id,
          name: f.properties.name,
          context: f.properties.place_formatted ?? "",
          center: f.geometry.coordinates,
          bounds: f.properties.bbox,
        }));
        setGeocoded({ q, places, failed: false });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setGeocoded({ q, places: [], failed: true });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, query, token]);

  const places = geocoded.q === q ? geocoded.places : [];
  const placeError = geocoded.q === q && geocoded.failed;
  const options: Option[] = [...beachHits.map((beach) => ({ kind: "beach" as const, beach })), ...places.map((place) => ({ kind: "place" as const, place }))];
  const showList = open && q.length >= 2;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const pick = (option: Option) => {
    setOpen(false);
    // Drop focus so a phone keyboard closes and the flight is visible.
    inputRef.current?.blur();
    if (option.kind === "beach") {
      setQuery(option.beach.name);
      onPickBeach(option.beach.id);
    } else {
      setQuery(option.place.name);
      onPickPlace(option.place);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!showList || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(options[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
      <label className="glass flex h-11 items-center gap-2 rounded-full px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foam">
        <SearchIcon className="h-4 w-4 shrink-0 text-mist" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && options.length ? `${listId}-${active}` : undefined}
          aria-label="Search beaches and places"
          placeholder="Search a beach or place"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 bg-transparent text-sm text-shell placeholder:text-mist outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      {showList && (
        <ul id={listId} role="listbox" className="glass fade-in absolute left-0 right-0 top-[52px] max-h-[60vh] overflow-y-auto rounded-2xl p-1.5">
          {options.map((option, i) => {
            const isBeach = option.kind === "beach";
            const title = isBeach ? option.beach.name : option.place.name;
            const sub = isBeach ? `${option.beach.area}, ${option.beach.country}` : option.place.context;
            return (
              <li
                key={isBeach ? `b-${option.beach.id}` : `p-${option.place.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(option)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${i === active ? "bg-tide/70" : ""}`}
              >
                {isBeach ? <WaveIcon className="h-4 w-4 shrink-0 text-foam" /> : <PinIcon className="h-4 w-4 shrink-0 text-mist" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-shell">{title}</span>
                  <span className="block truncate text-xs text-mist">{isBeach ? `Beach in ${sub}` : sub}</span>
                </span>
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-mist">
              {placeError ? "Place search is unavailable right now. Beach names still work." : "No beach or place matches that yet."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
