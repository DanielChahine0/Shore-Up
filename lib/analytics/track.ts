"use client";

import type { AnalyticsEvent, AnalyticsProps } from "./events";

// One random id per page load, held in memory only: no cookie, no storage, nothing to link visits.
let visitId: string | null = null;

/** Fire-and-forget. Analytics must never break or slow down the app. */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  try {
    visitId ??= crypto.randomUUID();
    const body = JSON.stringify({ event, props, visitId });
    void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // Ignored on purpose.
  }
}
