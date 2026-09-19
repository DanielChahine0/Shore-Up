import type { ZoneScore } from "@/lib/scores/types";
import { BANDS } from "@/lib/scores/config";

type Props = { zones: ZoneScore[]; activeZoneId: string | null; onFocusZone: (zoneId: string | null) => void };

/**
 * The beach laid out as it lies on the shore: one segment per zone, in order,
 * each showing its score. Mirrors the colored zones on the map.
 */
export function ShoreStrip({ zones, activeZoneId, onFocusZone }: Props) {
  return (
    <div>
      <div className="flex gap-1" role="list" aria-label="Zones along the shore">
        {zones.map((zone) => {
          const band = BANDS.find((b) => b.band === zone.band)!;
          return (
            <button
              key={zone.zoneId}
              type="button"
              role="listitem"
              onPointerEnter={() => onFocusZone(zone.zoneId)}
              onPointerLeave={() => onFocusZone(null)}
              onFocus={() => onFocusZone(zone.zoneId)}
              onBlur={() => onFocusZone(null)}
              aria-label={`${zone.name}: ${zone.score}, ${zone.label}`}
              className={`h-11 min-w-0 flex-1 rounded-lg text-sm font-semibold tabular-nums transition-transform duration-200 ${activeZoneId === zone.zoneId ? "-translate-y-0.5 ring-2 ring-shell" : ""}`}
              style={{ background: band.color, color: band.textOn }}
            >
              {zone.score}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-mist">
        <span>{zones[0]?.name}</span>
        <span>{zones[zones.length - 1]?.name}</span>
      </div>
    </div>
  );
}
