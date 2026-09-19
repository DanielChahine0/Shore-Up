/**
 * Profile badges: one emblem shape per group so the groups stay apart without
 * relying on colour, and every earned or locked state is spelled out in text.
 */

import type { BadgeCategory } from "@/lib/achievements/config";
import type { Badge, BadgeGroup } from "@/lib/profiles/badges";

const dateFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" });

type EmblemProps = { earned: boolean };

/** Hexagon holding a bin: the trash milestones. */
function TrashEmblem({ earned }: EmblemProps) {
  return (
    <Emblem>
      <path d="M12 2.4 20.5 7.2v9.6L12 21.6 3.5 16.8V7.2Z" fill={earned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <g className={earned ? "stroke-white" : "stroke-current"} fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.7 9.6h6.6l-.7 6.2H9.4Z" />
        <path d="M7.9 9.6h8.2" />
        <path d="M10.4 7.6h3.2" />
      </g>
    </Emblem>
  );
}

/** Circle holding sun and surf: the beach milestones. */
function BeachEmblem({ earned }: EmblemProps) {
  return (
    <Emblem>
      <circle cx="12" cy="12" r="9.3" fill={earned ? "currentColor" : "none"} fillOpacity={earned ? 0.75 : 1} stroke="currentColor" strokeWidth="1.4" />
      <g className={earned ? "stroke-white" : "stroke-current"} fill="none" strokeWidth="1.3" strokeLinecap="round">
        <path d="M8.4 11.3a3.6 3.6 0 0 1 7.2 0" />
        <path d="M5.4 14.6h13.2" />
        <path d="M6.2 17.4c1.2 0 1.2 1.1 2.4 1.1s1.2-1.1 2.4-1.1 1.2 1.1 2.4 1.1 1.2-1.1 2.4-1.1" />
      </g>
    </Emblem>
  );
}

/** Diamond holding three people: the community milestones. */
function CommunityEmblem({ earned }: EmblemProps) {
  return (
    <Emblem>
      <path d="M12 2.2 21.8 12 12 21.8 2.2 12Z" fill={earned ? "currentColor" : "none"} fillOpacity={earned ? 0.5 : 1} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <g className={earned ? "fill-white" : "fill-current"}>
        <circle cx="12" cy="9.1" r="1.7" />
        <circle cx="9" cy="13.9" r="1.7" />
        <circle cx="15" cy="13.9" r="1.7" />
      </g>
    </Emblem>
  );
}

function Emblem({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

const EMBLEMS: Record<BadgeCategory, (props: EmblemProps) => React.ReactElement> = {
  trash: TrashEmblem,
  beach: BeachEmblem,
  community: CommunityEmblem,
};

function BadgeCard({ badge, category }: { badge: Badge; category: BadgeCategory }) {
  const earned = Boolean(badge.earnedAt);
  const Shape = EMBLEMS[category];
  return (
    <li className={`rounded-2xl border p-3.5 ${earned ? "border-brand-strong/45 bg-brand-strong/10" : "border-line bg-surface"}`}>
      <div className={`flex items-start gap-3 ${earned ? "text-brand-strong" : "text-ink-soft"}`}>
        <Shape earned={earned} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{badge.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{badge.description}</p>
        </div>
      </div>
      {badge.progress ? <Progress label={badge.name} current={badge.progress.current} target={badge.progress.target} /> : null}
      <p className={`mt-2 text-[11px] font-medium ${earned ? "text-brand-strong" : "text-ink-soft"}`}>{earned ? `Earned ${dateFmt.format(new Date(badge.earnedAt!))}` : "Locked"}</p>
    </li>
  );
}

/** A bar and the same number in words, so the progress never depends on the bar. */
export function Progress({ label, current, target, unit = "items" }: { label: string; current: number; target: number; unit?: string }) {
  const value = Math.max(0, Math.min(current, target));
  const text = `${value} of ${target} ${unit}`;
  return (
    <div className="mt-2.5">
      <div
        role="progressbar"
        aria-label={`Progress toward ${label}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuetext={text}
        className="h-2 w-full overflow-hidden rounded-full bg-tint"
      >
        <div className="h-full rounded-full bg-brand-strong" style={{ width: `${target === 0 ? 0 : (value / target) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-ink-soft">{text}</p>
    </div>
  );
}

/** One labelled group of badges. Headings sit at level 3, under the Badges heading. */
export function BadgeGroupList({ group, earned }: { group: BadgeGroup; earned: number }) {
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{group.title}</h3>
        <p className="text-xs text-ink-soft">
          {earned} earned
          {group.moreEarned > 0 && `, ${group.moreEarned} older ${group.moreEarned === 1 ? "badge" : "badges"} not shown`}
        </p>
      </div>
      <ul className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {group.badges.map((badge) => (
          <BadgeCard key={badge.key} badge={badge} category={group.category} />
        ))}
      </ul>
    </section>
  );
}
