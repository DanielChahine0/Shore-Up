import { allowedProps, isAnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/events";

// Provisioned through Stripe Projects, which writes these to .env.
const HOST = process.env.POSTHOG_ANALYTICS_HOST ?? "";
const KEY = process.env.POSTHOG_ANALYTICS_API_KEY ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Forwards an allowlisted event to PostHog. The browser never talks to PostHog, so
 * PostHog never sees a visitor's IP address, and GeoIP and person profiles are off.
 */
export async function POST(request: Request) {
  if (!HOST || !KEY) return new Response(null, { status: 204 });

  let payload: { event?: unknown; props?: unknown; visitId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isAnalyticsEvent(payload.event) || typeof payload.visitId !== "string" || !UUID.test(payload.visitId)) {
    return new Response(null, { status: 400 });
  }
  const props = payload.props && typeof payload.props === "object" ? (payload.props as AnalyticsProps) : {};

  try {
    await fetch(`${HOST.replace("://us.", "://us.i.").replace("://eu.", "://eu.i.")}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event: payload.event,
        distinct_id: payload.visitId,
        properties: { ...allowedProps(payload.event, props), $geoip_disable: true, $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // PostHog being slow or down is not the visitor's problem.
  }
  return new Response(null, { status: 204 });
}
