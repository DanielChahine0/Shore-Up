"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { distanceKm, roundCoord } from "@/lib/geo/round";
import type { DirectoryEntry } from "@/lib/profiles/directory";
import { DIRECTORY_MODE_LABELS } from "@/lib/profiles/modes";
import { JoinButton } from "./JoinButton";

const NEAR_KM = 50;
const dateFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric" });
const select = "h-10 rounded-full border border-line bg-navy px-3 text-sm text-shell";

type Props = { people: DirectoryEntry[]; viewerId: string | null; joinedCleanupIds: string[] };

export function Directory({ people, viewerId, joinedCleanupIds }: Props) {
  const [mode, setMode] = useState("");
  const [beachId, setBeachId] = useState("");
  // Rounded in the browser and kept in memory only. It is never sent anywhere or stored.
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");

  const beaches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of people) if (p.nextCleanup) seen.set(p.nextCleanup.beachId, p.nextCleanup.beachName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [people]);

  const shown = people.filter(
    (p) =>
      (!mode || p.mode === mode) &&
      (!beachId || p.nextCleanup?.beachId === beachId) &&
      (!here || (p.near !== null && distanceKm(here, p.near) <= NEAR_KM)),
  );

  const toggleNear = () => {
    if (here) return setHere(null);
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: false, maximumAge: 600_000 },
    );
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleNear}
          aria-pressed={here !== null}
          disabled={locating === "busy"}
          className={`h-10 rounded-full border px-4 text-sm ${here ? "border-foam bg-foam/15 text-foam" : "border-line text-shell"}`}
        >
          {locating === "busy" ? "Finding you" : "Near me"}
        </button>
        <select aria-label="Filter by beach" value={beachId} onChange={(e) => setBeachId(e.target.value)} className={select}>
          <option value="">Any beach</option>
          {beaches.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by mode" value={mode} onChange={(e) => setMode(e.target.value)} className={select}>
          <option value="">Any mode</option>
          {Object.entries(DIRECTORY_MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {here && <p className="mt-2 text-xs text-mist">Showing people within about {NEAR_KM} km. Your location is rounded on this device and never saved.</p>}
      {locating === "denied" && <p className="mt-2 text-xs text-mist">Location is off for this site. Filter by beach instead, or allow location in your browser.</p>}

      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-mist">
          {people.length === 0 ? "Nobody is listed yet. Opt in from your profile to be the first." : "Nobody matches those filters. Try widening them."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {shown.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 py-4">
              <Link href={`/profile/${p.username}`} className="shrink-0" aria-label={`${p.displayName}'s profile`}>
                <Avatar name={p.displayName} src={p.avatarUrl} size={48} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/profile/${p.username}`} className="truncate text-[15px] font-medium text-shell hover:text-foam">
                    {p.displayName}
                  </Link>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${p.mode === "looking_for_volunteers" ? "border-foam/60 text-foam" : "border-line text-mist"}`}>
                    {DIRECTORY_MODE_LABELS[p.mode]}
                  </span>
                </div>
                <p className="truncate text-sm text-mist">{p.area || "Area not shared"}</p>
                <p className="mt-0.5 truncate text-sm text-shell">
                  {p.nextCleanup ? (
                    <Link href={`/cleanups/${p.nextCleanup.id}`} className="hover:text-foam">
                      {p.nextCleanup.beachName}, {dateFmt.format(new Date(p.nextCleanup.startsAt))}
                    </Link>
                  ) : (
                    <span className="text-mist">No cleanup planned</span>
                  )}
                </p>
              </div>
              {p.mode === "looking_for_volunteers" && p.nextCleanup && p.userId !== viewerId && (
                <JoinButton cleanupId={p.nextCleanup.id} returnTo="/people" joined={joinedCleanupIds.includes(p.nextCleanup.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
