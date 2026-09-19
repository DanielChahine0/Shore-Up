import { LITTER_LABELS, WATER_LABELS } from "@/lib/scores/config";
import type { ZoneScore } from "@/lib/scores/types";
import { ScoreBadge } from "./ScoreBadge";

type Props = { zones: ZoneScore[]; activeZoneId: string | null; onFocusZone: (zoneId: string | null) => void };

export function ZoneList({ zones, activeZoneId, onFocusZone }: Props) {
  return (
    <ul className="divide-y divide-line">
      {zones.map((zone) => (
        <li
          key={zone.zoneId}
          onPointerEnter={(e) => e.pointerType === "mouse" && onFocusZone(zone.zoneId)}
          onPointerLeave={() => onFocusZone(null)}
          className={`flex items-center justify-between gap-3 px-1 py-2.5 ${activeZoneId === zone.zoneId ? "bg-tide/40" : ""}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-shell">{zone.name}</p>
            <p className="text-xs text-mist">
              Water {WATER_LABELS[zone.waterStatus].toLowerCase()}, litter {LITTER_LABELS[zone.litterLevel].toLowerCase()}
            </p>
          </div>
          <ScoreBadge score={zone.score} />
        </li>
      ))}
    </ul>
  );
}
