import { ScoreBadge } from "@/components/panel/ScoreBadge";
import { LITTER_LABELS, SOURCE_LABELS, WATER_LABELS } from "@/lib/scores/config";
import type { ZoneScore } from "@/lib/scores/types";

function timeAgo(iso: string): string {
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Zone details on hover or tap: name, score, label, water, litter, last update. */
export function ZoneTooltip({ zone, x, y }: { zone: ZoneScore; x: number; y: number }) {
  const isDemo = zone.waterSource === "demo" || zone.litterSource === "demo";
  return (
    <div
      role="status"
      className="glass fade-in pointer-events-none absolute z-20 w-64 rounded-2xl p-3.5"
      style={{ left: `clamp(8px, ${x + 16}px, calc(100% - 264px))`, top: `clamp(8px, ${y + 16}px, calc(100% - 190px))` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{zone.name}</p>
        <ScoreBadge score={zone.score} />
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink">{zone.summary}</p>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-soft">Water</dt>
        <dd className="text-ink">{WATER_LABELS[zone.waterStatus]}</dd>
        <dt className="text-ink-soft">Litter</dt>
        <dd className="text-ink">{LITTER_LABELS[zone.litterLevel]}</dd>
        <dt className="text-ink-soft">Updated</dt>
        <dd className="text-ink">{timeAgo(zone.updatedAt)}</dd>
      </dl>
      {isDemo && <p className="mt-2 text-[11px] text-ink-soft">{SOURCE_LABELS.demo}</p>}
    </div>
  );
}
