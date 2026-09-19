"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinCommunity } from "@/app/actions/communities";
import { refreshViewer } from "@/components/chrome/useViewer";
import type { Community } from "@/lib/communities/queries";
import { distanceKm, roundCoord } from "@/lib/geo/round";

type Props = { communities: Community[]; joinedIds: string[] };

/** Communities to browse and join. "Near me" sorts by distance using a rounded, in-memory location. */
export function CommunityList({ communities, joinedIds }: Props) {
  const router = useRouter();
  const [joined, setJoined] = useState(new Set(joinedIds));
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sorted = here ? [...communities].sort((a, b) => distanceKm(here, a) - distanceKm(here, b)) : communities;

  const toggleNear = () => {
    if (here) return setHere(null);
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded on this device, kept in memory only, never sent or stored.
        setHere({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: false, maximumAge: 600_000 },
    );
  };

  const onJoin = (community: Community) => {
    setBusyId(community.id);
    setError(null);
    startTransition(async () => {
      const result = await joinCommunity(community.id, community.slug);
      setBusyId(null);
      if (!result.ok) return setError(result.error);
      setJoined((ids) => new Set(ids).add(community.id));
      refreshViewer();
      router.push(`/cn/${community.slug}`);
    });
  };

  return (
    <>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleNear}
          aria-pressed={here !== null}
          disabled={locating === "busy"}
          className={`h-11 rounded-full border px-4 text-sm ${here ? "border-brand-strong bg-brand-strong/15 text-brand-strong" : "border-line-strong bg-surface text-ink"}`}
        >
          {locating === "busy" ? "Finding you" : "Nearest first"}
        </button>
        {here && <p className="text-xs text-ink-soft">Sorted by distance. Your location is rounded on this device and never saved.</p>}
        {locating === "denied" && <p className="text-xs text-ink-soft">Location is off for this site, so the list stays alphabetical.</p>}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {sorted.map((c) => (
          <li key={c.id} className="flex flex-col rounded-3xl border border-line bg-surface p-5">
            <Link href={`/cn/${c.slug}`} className="text-lg font-semibold tracking-tight text-ink hover:text-brand-strong">
              {c.name}
            </Link>
            <p className="text-sm text-ink-soft">
              {c.area}
              {here && `, about ${Math.max(10, Math.round(distanceKm(here, c) / 10) * 10)} km away`}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
              {c.nonprofit && `, hosted by ${c.nonprofit.name}`}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {joined.has(c.id) ? (
                <Link href={`/cn/${c.slug}`} className="flex h-11 items-center rounded-full border border-line-strong px-5 text-sm text-ink">
                  Open feed
                </Link>
              ) : (
                <button type="button" onClick={() => onJoin(c)} disabled={busyId === c.id} className="h-11 rounded-full bg-brand-strong px-5 text-sm font-semibold text-white disabled:opacity-60">
                  {busyId === c.id ? "Joining" : "Join"}
                </button>
              )}
              {joined.has(c.id) && <span className="text-xs text-ink-soft">You&apos;re a member</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
