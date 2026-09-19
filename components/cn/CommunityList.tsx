"use client";
/* eslint-disable @next/next/no-img-element -- post photos are already resized and stored as WebP */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { joinCommunity } from "@/app/actions/communities";
import { refreshViewer } from "@/components/chrome/useViewer";
import type { Community, CommunityPreview } from "@/lib/communities/queries";
import { distanceKm, roundCoord } from "@/lib/geo/round";

type Props = { communities: Community[]; previews: Record<string, CommunityPreview>; joinedIds: string[] };

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" });
/** Long enough that sweeping the mouse across the list does not flash a preview on every card. */
const PREVIEW_DELAY_MS = 180;

/** Communities to browse and join. "Near me" sorts by distance using a rounded, in-memory location. */
export function CommunityList({ communities, previews, joinedIds }: Props) {
  const router = useRouter();
  const [joined, setJoined] = useState(new Set(joinedIds));
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);

  const showPreview = (id: string) => {
    // Touch screens have no hover, and a tap should simply open the community.
    if (!window.matchMedia("(hover: hover)").matches) return;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => setPreviewId(id), PREVIEW_DELAY_MS);
  };
  const hidePreview = () => {
    window.clearTimeout(previewTimer.current);
    setPreviewId(null);
  };

  // Escape dismisses the preview without moving the pointer or focus (WCAG 1.4.13).
  useEffect(() => {
    if (!previewId) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setPreviewId(null);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewId]);
  useEffect(() => () => window.clearTimeout(previewTimer.current), []);

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
          // The preview is a child of the card, so moving the pointer onto it keeps it open.
          <li
            key={c.id}
            onMouseEnter={() => showPreview(c.id)}
            onMouseLeave={hidePreview}
            onFocus={() => showPreview(c.id)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && hidePreview()}
            className={`relative flex flex-col rounded-3xl border bg-surface p-5 transition-colors hover:border-brand-strong ${previewId === c.id ? "z-10 border-brand-strong" : "border-line"}`}
          >
            {/* The link stretches over the whole card, so a click anywhere on it opens the community. */}
            <Link href={`/cn/${c.slug}`} className="text-lg font-semibold tracking-tight text-ink after:absolute after:inset-0 after:rounded-3xl hover:text-brand-strong">
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
            {/* Above the stretched link, so Join still joins. */}
            <div className="relative z-[1] mt-4 flex items-center gap-3 self-start">
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
            {previewId === c.id && <Preview community={c} preview={previews[c.slug]} />}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Hover card under a community: recent photos and the newest post, and a second way into the page.
 * It repeats what the community page holds and leads where the card's own link leads,
 * so it stays out of the tab order and the accessibility tree.
 */
function Preview({ community, preview }: { community: Community; preview: CommunityPreview | undefined }) {
  const photos = preview?.photoUrls ?? [];
  return (
    // The padding bridges the gap to the card, so the pointer never leaves the pair on its way down.
    <div className="absolute inset-x-0 top-full z-10 pt-2">
      <Link href={`/cn/${community.slug}`} tabIndex={-1} aria-hidden className="fade-in block rounded-3xl border border-line-strong bg-surface p-4 shadow-[0_12px_32px_rgb(15_47_58/0.18)] [animation-duration:180ms]">
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((url) => (
              <img key={url} src={url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-tint object-cover" />
            ))}
          </div>
        )}
        {preview?.latest ? (
          <>
            <p className={`text-xs text-ink-soft ${photos.length > 0 ? "mt-3" : ""}`}>
              Latest cleanup: {preview.latest.beachName}, {dateFmt.format(new Date(preview.latest.createdAt))}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink">{preview.latest.body}</p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">No cleanups posted yet. Be the first.</p>
        )}
        <p className="mt-3 text-sm font-semibold text-brand-strong">Open {community.name}</p>
      </Link>
    </div>
  );
}
