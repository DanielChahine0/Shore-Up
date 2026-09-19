# Shore Up MVP design

Approved on 2026-09-19.
The product brief is the source of truth for features.
This document records the architecture chosen to deliver it, and `DECISIONS.md` logs the smaller judgment calls.

## Architecture

- Next.js App Router with TypeScript and Tailwind, Mapbox GL JS with globe projection, Supabase, and Stripe.
- Beach and zone geometry lives in the repo as GeoJSON generated from OpenStreetMap.
- State lives in Supabase Postgres: water readings, cleanups, people, communities, posts, and donations.
- `getBeachZones(beachId)` in `lib/scores/` is the only score interface the UI uses.
- Water status is the latest `water_readings` row per zone, tagged with a source of demo, official, model, or volunteer.
- The forecasting service will insert rows with `source = 'model'` and nothing in the UI changes.
- Litter is derived at read time from the zone's latest real cleanup post.
- Every score rule lives in `lib/scores/config.ts`.

## Map

- One light style stripped down to land, water, borders, and major labels, with beaches drawn as sand shapes. (Originally a dark style with satellite imagery; see DECISIONS.md.)
- A clustered GeoJSON source for neutral beach dots.
- Zone fill, zone score labels, and a glowing outline for the selected beach only.
- The map is mounted in a layout shared by `/` and `/beach/[id]`.

## Writes

- Server actions for ordinary writes.
- Posting a cleanup is one Postgres function in a transaction that inserts the post, awards achievements, and returns new badges.
- Photos pass through a route handler that validates type and size and re-encodes with `sharp`, which drops all EXIF data.
- Stripe Checkout sessions carry the recipient type and id in metadata, and the webhook verifies the signature before marking a donation paid.

## Privacy

- No table has a user location column.
- Other users are only visible through the `public_profiles` view, which requires the 18+ confirmation and excludes hidden profiles.
- The people directory also requires opt-in.
- Browser location is rounded on the client and used only for sorting.

## Schema

See `supabase/migrations/0001_schema.sql` and `0002_rls.sql`.

## Build order

1. Globe, search, beach selection, zones, and side panel on seed data.
2. Auth, profiles, and the people directory.
3. Communities and Community News posts, including score updates.
4. Stripe donations.

Each phase ends with a stop for testing.

## Testing

- Vitest for score rules and zone splitting.
- Playwright end-to-end checks per phase.
