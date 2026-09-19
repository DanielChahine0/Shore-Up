"use client";

import { CloseIcon } from "@/components/ui/icons";
import type { BeachSummary } from "@/lib/beaches";
import Link from "next/link";
import { PostCard } from "@/components/cn/PostCard";
import type { CleanupSummary } from "@/lib/cleanups/queries";
import type { FeedPost } from "@/lib/communities/queries";
import type { BeachScore } from "@/lib/scores/types";
import { SOURCE_LABELS } from "@/lib/scores/config";
import { ScoreBadge } from "./ScoreBadge";
import { ShoreStrip } from "./ShoreStrip";
import { ZoneList } from "./ZoneList";

export type PanelAction = "join" | "host" | "post" | "donate";

const cleanupDate = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Props = {
  beach: BeachSummary;
  score: BeachScore | null;
  upcomingCleanups: CleanupSummary[];
  recentPosts: FeedPost[];
  error: string | null;
  activeZoneId: string | null;
  /** Phone bottom sheet state. Ignored on desktop. */
  expanded: boolean;
  onToggleExpanded: () => void;
  onFocusZone: (zoneId: string | null) => void;
  onAction: (action: PanelAction) => void;
  onRetry: () => void;
  onClose: () => void;
};

/** Side panel on desktop, bottom sheet on phones. */
export function BeachPanel({ beach, score, upcomingCleanups, recentPosts, error, activeZoneId, expanded, onToggleExpanded, onFocusZone, onAction, onRetry, onClose }: Props) {
  return (
    <aside
      aria-label={`${beach.name} details`}
      className={`glass glass-panel fade-in fixed inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl transition-[max-height] duration-300 ease-out sm:absolute sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-[76px] sm:w-[380px] sm:max-h-none sm:rounded-3xl ${expanded ? "max-h-[var(--sheet-expanded)]" : "max-h-[var(--sheet-peek)]"}`}
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse beach details" : "Expand beach details"}
        className="flex h-6 w-full shrink-0 items-center justify-center sm:hidden"
      >
        <span className="h-1 w-10 rounded-full bg-ink-soft/50" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{beach.name}</h1>
            <p className="text-sm text-ink-soft">
              {beach.area}, {beach.country}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close beach details" className="-mr-1.5 rounded-full p-1.5 text-ink-soft hover:text-ink">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-line p-4 text-sm text-ink">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-full bg-brand-strong px-4 py-1.5 text-sm font-medium text-white">
              Try again
            </button>
          </div>
        )}

        {!score && !error && <PanelSkeleton />}

        {score && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <ScoreBadge score={score.score} size="lg" />
              <span className="whitespace-nowrap text-sm text-ink-soft">across {score.zones.length} zones</span>
              {score.hasDemoData && (
                <span className="ml-auto whitespace-nowrap rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-ink-soft">{SOURCE_LABELS.demo}</span>
              )}
            </div>

            <div className="mt-4">
              <ShoreStrip zones={score.zones} activeZoneId={activeZoneId} onFocusZone={onFocusZone} />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink">{score.reason}</p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onAction("join")} className="col-span-2 h-10 rounded-full bg-brand-strong text-sm font-semibold text-white">
                Join a cleanup
              </button>
              <button type="button" onClick={() => onAction("post")} className="h-10 rounded-full border border-brand-strong/60 text-sm font-semibold text-brand-strong">
                Post a cleanup
              </button>
              <button type="button" onClick={() => onAction("donate")} className="h-10 rounded-full border border-brand-strong/60 text-sm font-semibold text-brand-strong">
                Donate
              </button>
            </div>

            <section className="mt-6">
              <h2 className="text-sm font-semibold text-ink">Zones</h2>
              <div className="mt-1">
                <ZoneList zones={score.zones} activeZoneId={activeZoneId} onFocusZone={onFocusZone} />
              </div>
            </section>

            <section className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Upcoming cleanups</h2>
                <button type="button" onClick={() => onAction("host")} className="text-sm font-medium text-brand-strong">
                  Host a cleanup
                </button>
              </div>
              {upcomingCleanups.length === 0 ? (
                <p className="mt-1.5 text-sm text-ink-soft">None planned here yet. Host one and others nearby can join.</p>
              ) : (
                <ul className="mt-1 divide-y divide-line">
                  {upcomingCleanups.map((c) => (
                    <li key={c.id}>
                      <Link href={`/cleanups/${c.id}`} className="flex items-center justify-between gap-3 px-1 py-2.5 hover:bg-tint/40">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{cleanupDate.format(new Date(c.startsAt))}</span>
                          <span className="block truncate text-xs text-ink-soft">Hosted by {c.organizerName ?? "a volunteer"}</span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-soft">{c.attendeeCount} going</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-semibold text-ink">Community News from this beach</h2>
              {recentPosts.length === 0 ? (
                <p className="mt-1.5 text-sm text-ink-soft">No cleanup posts yet. The first one turns a zone greener.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {recentPosts.map((post) => (
                    <PostCard key={post.id} post={post} compact />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function PanelSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4" aria-label="Loading beach score">
      <div className="h-8 w-40 rounded-full bg-tint/60" />
      <div className="h-11 rounded-lg bg-tint/60" />
      <div className="h-16 rounded-lg bg-tint/40" />
    </div>
  );
}
