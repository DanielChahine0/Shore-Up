# Decisions

Judgment calls made where the spec was open.
The simplest option was chosen each time.

## Scores

- **Unsafe water caps the score at 25.**
  The formula alone gives an unsafe zone with clean sand a 50 (Poor).
  The spec says it must show red, so the score is capped into the Avoid band and the number and label always agree.
- **Litter is derived, not stored.**
  The litter level is computed at read time from the zone's last cleanup, using the 7 and 14 day rules.
  There is no cron job and no stored counter that can drift.
- **Demo litter uses a relative age.**
  Each zone stores `demo_last_cleaned_days`, and the zone reads as last cleaned that many days ago until a volunteer posts.
  This keeps the Woodbine demo stable on any day, and lets the tooltip say "last cleaned 14 days ago".
- **A score is computed against one instant.**
  Demo litter ages are relative ("14 days ago"), and reading a clock twice (the database's, or the server's again after a network request) landed a few milliseconds apart.
  That was enough to turn 14 days into 13 and move a zone from Poor to Fair.
  The caller's `now` is passed into every data source, and demo ages are rebuilt from the stored day count.
- **Seeded demo posts never change a litter score.**
  Posts flagged `is_demo` fill the feeds but are ignored by the `zone_state` view, so only real cleanups move the map.
- **The beach score is the plain mean of its zone scores.**
  The reason text names any unsafe or heavy-litter zones, so a red zone is never hidden by a decent average.
- **Two sources behind one interface.**
  `getBeachZones` reads from Supabase when it is configured and from `data/seed/zone-state.json` otherwise.
  Phase 1 runs with only a Mapbox token, and the forecasting service later adds `water_readings` rows with `source = 'model'`.
- **Scale colors vary lightness as well as hue.**
  Clean is the lightest and Avoid the darkest, and every zone shows its score number on the map and its label in the panel.

## Beach data

- **Beaches are found by name inside a city's bounding box.**
  Nominatim gives the city's bounds and Overpass returns named `natural=beach` polygons inside them.
  No coordinates are written by hand.
- **Skipped beaches:** Marie Curtis Park East, La Jolla Shores, Playa Norte, Bournemouth, Scheveningen, and Piha have no matching named polygon in OpenStreetMap.
  They are logged in `data/geo/skipped.log`, which leaves 45 beaches, 9 of them in Toronto.
- **Centre Island Beach is mapped in OpenStreetMap as Manitou Beach**, its official name, so it is matched on that.
- **Kew-Balmy Beach is the union of the separate Kew Beach and Balmy Beach polygons.**
- **Kite Beach replaces Jumeirah Beach**, because Kite Beach is the polygon OpenStreetMap actually has there.
- **Zones are equal-length strips along the beach's long axis.**
  The axis comes from the minimum-area rotated bounding box, and a beach gets one zone per 150 m, between 3 and 8.
  Zones are named Zone A, Zone B, and so on, ordered west to east, or south to north.
- **GeoJSON files use a `.json` extension** so the server can import them directly.

## Map

- **One dark style, with satellite as a raster layer whose opacity follows zoom** (invisible at zoom 10, opaque at 13.5).
  There is no style swap, so custom layers are never wiped.
- **Leaving a beach never resets the camera.**
  Closing the panel leaves the view exactly where it is.
  "Back to globe" zooms out to the whole globe centered on the current spot, not the starting view.
- **The globe stops rotating on the first touch and does not resume**, so the user's position is never moved for them.
- **"Back to globe" is offered whenever the map is zoomed past the whole-globe view**, not only while a beach is open.
- **The map lives in a shared layout** for `/` and `/beach/[id]`, so selecting a beach moves the camera instead of reloading the globe.
- **The selected beach swaps its dot for the outline and zones.**
  Every other beach stays a neutral dot at every zoom level.
- **Clicking a cluster flies to the area covering all of its beaches**, not just one zoom level in.
- **The globe rotates at 3 degrees per second, timed per frame**, and is sized down on phones so the whole sphere fits.
- **The phone bottom sheet expands to 62% of the screen.**
  Any taller and the donate button and the required Mapbox logo and attribution would slide under the top bar.
- **On desktop, the donate button and attribution slide left of the open side panel** so neither is covered.
- **The beach panel is nearly opaque** rather than frosted, because long text over satellite imagery was hard to read.
- **`window.__shoreMap` exposes the map in development only**, for debugging and tests.
- **Camera flights are 2.6 seconds** and are skipped for users who prefer reduced motion.

## Product

- **A user can join several communities.**
  The CN pill shows the first one they joined.
- **Stats and levels are a SQL view over posts**, not counters, so they cannot drift.
- **Phase 1 action buttons show a short note** saying which phase opens them.
  The CN pill and Sign in link point at pages that arrive in phases 2 and 3.

## Accounts and people

- **Profiles are created by a database trigger on sign-up**, so every account has one no matter how it signed up (email or Google).
  Usernames are generated from the display name and made unique with a short suffix.
- **The 18+ confirmation is optional at sign-up.**
  Without it a user can still use Shore Up privately, but nobody else can see them, as the spec requires.
  Opting in to the directory is only possible after confirming.
- **"Near me" never leaves the browser.**
  The location is rounded to 1 decimal place (about 11 km) on the device, held in memory only, and compared against a coarse reference point for each person.
  That reference is the beach of their next cleanup or a beach in their stated area, never a personal location, which Shore Up does not collect.
- **People taking a break are left out of the directory**, since the spec lists only three directory badges.
- **A host's own cleanup is the one shown in the directory**, ahead of any cleanup they are only attending, so "Join" always joins the right event.
- **Joining goes through a database function** so the Crew Leader badge is awarded in the same transaction when a cleanup reaches 5 people, organizer included.
- **Attendee lists show public profiles only**, plus a count of people with private profiles.
- **Avatar uploads go through the server**, which checks the real file type, re-encodes to WebP (dropping all EXIF and GPS data), and crops to 512 px.
- **"Join a cleanup" on a beach opens that beach's next cleanup.**
  With none planned it offers to host one.
- **Cleanup times are picked in the visitor's time zone** and stored as an exact instant.
- **Google's logo is drawn in one color**, because green, yellow, and red are reserved for the cleanliness scale.
- **The avatar opens the profile, and Sign out lives on the profile page**, matching the layout spec.

## Tooling

- pnpm, Vitest for unit tests, and Playwright for end-to-end checks.
- The project was scaffolded in a lowercase temp folder, because npm rejects the capital letters in `Shore-Up`.
