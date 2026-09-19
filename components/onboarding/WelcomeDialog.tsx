"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { PlaceResult } from "@/components/chrome/SearchBar";
import { GlobeIcon, SearchIcon } from "@/components/ui/icons";
import { roundCoord } from "@/lib/geo/round";
import { MAX_SUGGESTIONS, geocodePlaces } from "@/lib/place/geocode";
import { saveHomePlace, useHomePlace } from "@/lib/place/usePlace";
import { AlertIcon, LocateIcon, PersonIcon } from "./icons";

export type WelcomeDialogProps = {
  mapboxToken: string;
  signedIn: boolean;
  /** Flies the map to the chosen place. */
  onPickPlace: (place: PlaceResult) => void;
};

const WELCOMED_KEY = "shoreup.welcomed";
/** The sign-in page has no sign-up parameter, so it opens on sign in with a toggle to join. */
const SIGN_IN_HREF = "/signin?next=%2F";
const SIGN_UP_HREF = "/signin?mode=signup&next=%2F";

const tile =
  "flex min-h-[7rem] flex-col rounded-2xl border border-line bg-tide/35 p-4 text-left hover:border-foam/60 hover:bg-tide/60";

function isWelcomed() {
  try {
    return window.localStorage.getItem(WELCOMED_KEY) === "1";
  } catch {
    // Private windows can refuse storage. The popup then shows once per visit.
    return false;
  }
}

function markWelcomed() {
  try {
    window.localStorage.setItem(WELCOMED_KEY, "1");
  } catch {
    // Same as above: nothing to keep, nothing to do.
  }
}

/**
 * The end-to-end suite loads the map with empty storage, so this popup would sit on top of
 * every test. It stays out of automated runs unless a test opts in with ?welcome=1.
 */
function skippedForAutomation() {
  try {
    return navigator.webdriver && new URLSearchParams(window.location.search).get("welcome") !== "1";
  } catch {
    return false;
  }
}

const subscribeNever = () => () => {};

/** False through the server render and the first client render, so nothing flashes on hydration. */
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/** First-visit popup: sign up or continue as a guest, then choose a place. */
export function WelcomeDialog({ mapboxToken, signedIn, onPickPlace }: WelcomeDialogProps) {
  const mounted = useMounted();
  const { place } = useHomePlace();
  const [closed, setClosed] = useState(false);

  // Someone who already chose a place, or already said no, is left alone.
  const show = mounted && !closed && !isWelcomed() && !skippedForAutomation() && !(signedIn && place !== null);
  if (!show) return null;

  return <Panel mapboxToken={mapboxToken} signedIn={signedIn} onPickPlace={onPickPlace} onDone={() => setClosed(true)} />;
}

type PanelProps = WelcomeDialogProps & { onDone: () => void };

function Panel({ mapboxToken, signedIn, onPickPlace, onDone }: PanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const locateRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  // Someone who is already signed in has nothing to sign up for: they only pick a place.
  const [step, setStep] = useState<"choose" | "place">(signedIn ? "place" : "choose");
  const [query, setQuery] = useState("");
  // Suggestions carry the query they answer, so a slow response never shows against newer text.
  const [suggest, setSuggest] = useState<{ q: string; places: PlaceResult[]; failed: boolean }>({ q: "", places: [], failed: false });
  const [active, setActive] = useState(0);
  // Escape hides the suggestions without touching what was typed, then closes the dialog.
  const [dismissed, setDismissed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
  const listId = `${ids}-list`;
  const inputId = `${ids}-input`;

  // See NewPostModal: no close() on cleanup, or the dev double-mount dismisses the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Step two replaces everything that had focus, so focus moves to its primary action.
  useEffect(() => {
    if (step === "place") locateRef.current?.focus();
  }, [step]);

  const q = query.trim();

  useEffect(() => {
    if (q.length < 3 || !mapboxToken) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSuggest({ q, places: await geocodePlaces(q, mapboxToken, controller.signal), failed: false });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSuggest({ q, places: [], failed: true });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, mapboxToken]);

  const places = suggest.q === q ? suggest.places : [];
  const failed = suggest.q === q && suggest.failed;
  const showList = q.length >= 3 && !dismissed && (places.length > 0 || failed);

  /** Runs once: marks the visitor welcomed, closes the dialog, then does whatever they asked for. */
  const finish = (after?: () => void) => {
    if (done.current) return;
    done.current = true;
    markWelcomed();
    dialogRef.current?.close();
    onDone();
    after?.();
  };

  const choose = (result: PlaceResult) => {
    saveHomePlace({ name: result.name, lat: result.center[1], lng: result.center[0] });
    finish(() => onPickPlace(result));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      return setError("This browser can't share your location. Type a place in the field below instead.");
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded the moment it arrives, so the precise position is never held or saved.
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        choose({ id: "near-me", name: "Near me", context: "Your rough area", center: [lng, lat] });
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site. Type a place in the field below instead, like Toronto."
            : "We couldn't work out where you are. Type a place in the field below instead, like Toronto.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showList) return;
    if (e.key === "Escape") {
      // This Escape closes the suggestions. The next one closes the dialog.
      e.preventDefault();
      return setDismissed(true);
    }
    if (places.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % places.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + places.length) % places.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(places[active]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => finish()}
      onClick={(e) => e.target === dialogRef.current && finish()}
      aria-labelledby={`${ids}-title`}
      className="glass glass-panel fade-in m-auto max-h-[92dvh] w-[min(94vw,440px)] overflow-y-auto rounded-3xl p-0 text-shell backdrop:bg-abyss/70"
    >
      {step === "choose" ? (
        <div className="p-6">
          <h2 id={`${ids}-title`} className="text-xl font-semibold tracking-tight">
            Welcome to Shore Up
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-mist">
            Shore Up maps how clean the world&apos;s beaches are, so you can find the ones near you and help look after them.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={SIGN_UP_HREF} className={tile}>
              <PersonIcon className="h-5 w-5 text-foam" />
              <span className="mt-3 block text-sm font-semibold">Create an account</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">Post cleanups, host one, and join a community.</span>
            </Link>
            <button type="button" onClick={() => setStep("place")} className={tile}>
              <GlobeIcon className="h-5 w-5 text-foam" />
              <span className="mt-3 block text-sm font-semibold">Continue as guest</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">Explore the map and see what needs help.</span>
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-mist">
            <Link href={SIGN_IN_HREF} className="rounded-full font-medium text-foam hover:underline">
              I already have an account
            </Link>
          </p>
        </div>
      ) : (
        <div className="p-6">
          <h2 id={`${ids}-title`} className="text-xl font-semibold tracking-tight">
            Where do you want to look after?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-mist">The globe will take you there. You can move anywhere else whenever you like.</p>

          <button
            ref={locateRef}
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foam text-sm font-semibold text-foam-deep disabled:opacity-60"
          >
            <LocateIcon className="h-4 w-4" />
            {locating ? "Finding you" : "Use my location"}
          </button>

          {error && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-navy px-3 py-2.5 text-sm leading-relaxed">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-mist">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <label htmlFor={inputId} className="block text-sm font-medium">
            Or type a place
          </label>
          <div className="relative mt-1.5">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-activedescendant={showList && places.length > 0 ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder="Toronto"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setDismissed(false);
              }}
              onKeyDown={onKeyDown}
              className="h-12 w-full rounded-xl border border-line bg-navy pl-10 pr-3 text-sm text-shell placeholder:text-mist"
            />
          </div>

          {showList && (
            <ul id={listId} role="listbox" aria-label="Place suggestions" className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-line bg-navy p-1.5">
              {places.slice(0, MAX_SUGGESTIONS).map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={`flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2 ${i === active ? "bg-tide/70" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{p.name}</span>
                    {p.context && <span className="block truncate text-xs text-mist">{p.context}</span>}
                  </span>
                </li>
              ))}
              {places.length === 0 && <li className="px-3 py-2 text-sm text-mist">Place search is unavailable right now. You can skip this and search later.</li>}
            </ul>
          )}

          <p className="mt-4 text-xs leading-relaxed text-mist">We only keep a rough area, on this device. Your exact location is never stored.</p>

          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => finish()} className="flex h-11 items-center rounded-full px-4 text-sm font-medium text-foam hover:underline">
              Skip for now
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
