import { NextResponse } from "next/server";
import { listBeachShapes } from "@/lib/beaches";

/** Every beach outline, so the map can draw beaches as sand before one is selected. Geometry never changes at runtime. */
export function GET() {
  return NextResponse.json(listBeachShapes(), { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
