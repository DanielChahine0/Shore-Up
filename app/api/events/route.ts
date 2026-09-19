import { NextResponse } from "next/server";
import { listUpcomingEvents } from "@/lib/cleanups/events";
import type { EventItem } from "@/lib/cleanups/rank";

export type EventsResponse = { events: EventItem[] };

export async function GET() {
  try {
    const events = await listUpcomingEvents();
    return NextResponse.json({ events } satisfies EventsResponse);
  } catch {
    return NextResponse.json({ error: "The events list didn't load." }, { status: 500 });
  }
}
