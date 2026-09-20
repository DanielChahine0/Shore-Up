# Contributing to Shore Up

Thanks for wanting to help.
Shore Up started as a one-day hackathon project, and contributions of any size are welcome.

## Ways to help

- Report a bug or a beach with wrong data by opening an issue.
- Add a beach to `data/beaches.seed.json` and rerun `pnpm fetch:beaches`.
- Add an official water quality source under `scripts/official/`.
- Pick up an open issue and send a pull request.

## Setup

Follow the Setup section of the [README](README.md).
A Mapbox token is enough to run the app on demo data.
Supabase is only needed for sign-in, posts, and cleanups.

## Before you open a pull request

Run every check locally.
All of them must pass.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e   # needs a Mapbox token
```

## Conventions

- This project uses Next.js 16, which has breaking changes from earlier versions.
  Read the relevant guide in `node_modules/next/dist/docs/` before changing framework code.
- Keep every score rule in `lib/scores/config.ts` and every badge rule in `lib/achievements/config.ts`.
- Read scores through `getBeachZones`, never from a data source directly.
- Log any judgment call where the spec was open in `DECISIONS.md`.
- Add or update tests with every behavior change.
- Fix the root cause of a bug, and reproduce it end to end first.
- Never commit secrets.
  `.env.local` is git-ignored, and `.env.example` lists every variable without values.
- In Markdown, keep each sentence on its own line.

## Pull requests

- Branch from `main` and keep each pull request to one change.
- Describe what changed and why, and add screenshots for anything visual, on desktop and phone sizes.
- Link the issue the pull request closes.

## Data licensing

Beach shapes come from OpenStreetMap and stay under the Open Database License.
Only add water quality sources whose terms allow redistribution, and credit them in the README and the map attribution.

## Code of Conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
