# Shore Up

See how clean a beach is, zone by zone, and who is already helping it.
Shore Up opens on a 3D globe, flies into a beach, and shows its zones on a green-to-red cleanliness scale.
Volunteers post cleanups, and every post shows up on the map, in their community, and on their profile.

## Status

The MVP is built in four phases.

1. Globe, search, beach selection, zones, and side panel on seed data. **Built.**
2. Auth, profiles, and the people directory.
3. Communities and Community News posts, including score updates.
4. Stripe donations.

## Setup

Requirements: Node 22 or newer and pnpm.

```bash
pnpm install
cp .env.example .env.local
# fill in .env.local, then:
pnpm dev
```

Open http://localhost:3000.

## Environment variables

All secrets live in `.env.local`, which is git-ignored.
`.env.example` lists every variable.

| Variable | Needed from | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Phase 1 | account.mapbox.com, Tokens, default public token (`pk.`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Phase 2 (optional in 1) | Supabase dashboard, Project Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 2 (optional in 1) | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 2 (optional in 1) | Same page. Server only, bypasses Row Level Security |
| `STRIPE_SECRET_KEY` | Phase 4 | dashboard.stripe.com in test mode, Developers, API keys |
| `STRIPE_WEBHOOK_SECRET` | Phase 4 | Printed by `stripe listen` |
| `NEXT_PUBLIC_SITE_URL` | Phase 4 | `http://localhost:3000` locally |

Variables prefixed `NEXT_PUBLIC_` are sent to the browser.
Never put that prefix on the service role key or a Stripe secret.

Until the Supabase variables are set, zone scores come from the demo file `data/seed/zone-state.json`.
Once they are set, scores come from the database through the same `getBeachZones` interface.

## Database

1. Create a Supabase project.
2. Run the files in `supabase/migrations/` in order, in the Supabase SQL editor or with `supabase db push`.
3. Add the three Supabase variables to `.env.local`.
4. Run the seed script.

```bash
pnpm seed
```

The seed script is safe to re-run.
It upserts beaches and zones and replaces demo water readings only.

## Beach data

Beach shapes come from OpenStreetMap and are committed in `data/geo/`.
You only need to regenerate them when `data/beaches.seed.json` changes.

```bash
pnpm fetch:beaches   # Overpass API, natural=beach, splits zones, logs skips
pnpm gen:demo        # regenerates demo water and litter state for every zone
```

Beaches with no named `natural=beach` polygon in OpenStreetMap are skipped and listed in `data/geo/skipped.log`.
Map data is (c) OpenStreetMap contributors, credited in the map attribution.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit tests (score rules, zone splitting) |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript |
| `pnpm fetch:beaches` | Pull beach polygons from OpenStreetMap |
| `pnpm gen:demo` | Generate demo zone state |
| `pnpm seed` | Seed Supabase |

## Where things live

- `lib/scores/config.ts` holds every score rule: points, weights, bands, colors, and litter decay.
- `lib/scores/getBeachZones.ts` is the one data interface for scores.
- `lib/scores/sources.ts` holds the data sources behind it (demo file, Supabase, and later the forecasting service).
- `components/map/` holds the globe, layers, and camera.
- `components/panel/` holds the beach side panel, which becomes a bottom sheet on phones.
- `DECISIONS.md` logs every judgment call made where the spec was open.
