import { NextResponse } from "next/server";
import { getBeach, getBeachShape, getZoneShapes } from "@/lib/beaches";
import type { BeachDetail } from "@/lib/beachDetail";
import { listUpcomingCleanups } from "@/lib/cleanups/queries";
import { listPosts } from "@/lib/communities/queries";
import { getBeachScore } from "@/lib/scores/getBeachZones";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const beach = getBeach(id);
  const outline = getBeachShape(id);
  if (!beach || !outline) return NextResponse.json({ error: "Beach not found" }, { status: 404 });

  const [score, upcomingCleanups, recentPosts] = await Promise.all([getBeachScore(id), listUpcomingCleanups(id, 3), listPosts({ beachId: id }, null, 3)]);
  const byZone = new Map(score.zones.map((z) => [z.zoneId, z]));
  const detail: BeachDetail = {
    beach,
    outline,
    score,
    upcomingCleanups,
    recentPosts,
    zones: {
      type: "FeatureCollection",
      features: getZoneShapes(id).flatMap((shape) => {
        const zone = byZone.get(shape.properties?.id);
        if (!zone) return [];
        return [{ ...shape, properties: { zoneId: zone.zoneId, name: zone.name, score: zone.score, label: zone.label, color: zone.color } }];
      }),
    },
  };
  return NextResponse.json(detail);
}
