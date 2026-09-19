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

- **The map shows beaches and almost nothing else.**
  It starts from Mapbox's light style and hides every layer except land, water, country borders, and country, continent, and major city labels.
  Roads, buildings, land use, points of interest, and satellite imagery are gone, so nothing competes with a beach.
  The kept layers are listed in `components/map/mapConfig.ts`.
- **Land is a light grey-green (`#C7E1E3`) and the sea is the logo blue**, easing a little lighter as you zoom in.
  The sea stays darker than the land at every zoom, so the coastline never fades out.
- **Every beach is drawn as a sand shape from zoom 9**, served once by `/api/beaches/shapes`, so beaches read as places before one is selected.
- **Leaving a beach never resets the camera.**
  Closing the panel leaves the view exactly where it is.
- **The globe stops rotating on the first touch and does not resume**, so the user's position is never moved for them.
- **There is no "Back to globe" button.**
  It was removed at the owner's request; zooming out and search cover the same need.
- **The map lives in a shared layout** for `/` and `/beach/[id]`, so selecting a beach moves the camera instead of reloading the globe.
- **The selected beach swaps its dot for the outline and zones.**
  Every other beach stays a neutral white dot ringed in deep blue at every zoom level.
- **Clicking a cluster flies to the area covering all of its beaches**, not just one zoom level in.
- **The globe rotates at 3 degrees per second, timed per frame**, and is sized down on phones so the whole sphere fits.
- **The phone bottom sheet expands to 62% of the screen.**
  Any taller and the Log trash button and the required Mapbox logo and attribution would slide under the top bar.
- **On desktop, the Log trash button and attribution slide left of the open side panel** so neither is covered.
- **The beach panel is nearly opaque** rather than frosted, so the map never shows through long text.
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

## Communities and Community News

- **Posting a cleanup is one database function**, `create_cleanup_post`.
  It checks membership, that the zone belongs to the beach, and that every photo was uploaded by the poster, then writes the post and awards badges in one transaction.
  Direct inserts into `posts` are closed, so the rules cannot be skipped.
- **A cleanup post must go to a community**, because Community News is where posts live.
  "Post a cleanup" sends a user with no community to the communities list first.
- **The CN pill shows the first community a user joined** and links to its feed.
  With no community it reads "CN: Join" and opens the communities list, which can be sorted nearest first.
- **The pill opens the communities page rather than a modal**, so the same list serves the pill, the header link, and a direct URL.
- **The post form starts on the zone a cleanup would help most**: the one the user was hovering, otherwise the lowest-scoring zone whose water is not unsafe.
- **After posting from the map, the beach reloads in place**, so the zone fades to its new color without moving the camera.
- **Reports are write-only.**
  Users can file one report per post and cannot read reports back; moderators read them with the service role.
- **Feeds show public author details only.**
  A post by someone with a private profile appears as "A volunteer".
- **Likes update at once and roll back if the server refuses.**
- **Demo post photos are public domain photos of real beach cleanups** from Wikimedia Commons, stored in `public/photos/cleanups`.
  This replaced generated abstract shorelines, at the owner's request, so the feed looks like the real thing.
  The feed shows no credit line, so it only uses photos that need none; no photo is a close-up of a child.
- **Events borrow a stock cleanup photo**, picked from the event id so it never changes, because events have no photo of their own yet.
  Some of these are CC BY 2.0, so every event photo shows its credit and links to its source.
  The list, with alt text and licenses, is `lib/images/cleanupPhotos.ts`.
- **Demo posts count toward demo users' stats and badges** but never toward a zone's litter score.
- **A stale session is cleared quietly.**
  If the account behind a saved session no longer exists, the app signs out locally instead of erroring.

## Look and accessibility

- **Light mode only, in white and the logo blue `#499AB2`.**
  There is no dark theme, and `color-scheme: light` stops browsers from inventing one.
- **The logo blue never sits behind small white text**, because that pair is only 3.2:1.
  It is used for the logo, large shapes, and the sea.
  Buttons, links, and focus rings use a darker shade of the same hue, `#2A6F85`, which is 5.7:1 with white.
- **Every text pair meets WCAG 2.1 AA (4.5:1), and every control edge meets 3:1**, which is what AODA requires.
  Inputs, selects, and outlined buttons use the stronger border color; cards keep the soft decorative one.
  The ratios are recorded beside the tokens in `app/globals.css`.
- **Every button, input, and select is at least 44px tall**, so touch targets are comfortable on phones.
- **The clean session sheet keeps Finish and Discard in a fixed footer**, outside the scrolling list of twelve items.
  Each item shows its count between its minus and plus buttons, which span the card at any width down to 320px.
- **Below 370px the header logo drops its wordmark**, so the CN pill and Sign in never overlap it.
- **The events panel is full width on phones**, and on desktop the search bar hides while it is open, so nothing pokes out beside or behind it.
- **The top bar holds every map control**: logo and search on the left, then Events, the community button, and Sign in or the avatar on the right.
  Events used to float over the map under the logo; in the bar it lines up with the rest and is icon only on phones.
- **The community button is the owner's two-person icon, not the "CN:" text.**
  Its name lives in the accessible label and the tooltip.
- **Hovering or focusing a community card shows a preview** with recent photos and the newest post; clicking the card or the preview opens the community.
  It waits 180ms so a sweep across the list does not flash, stays open while the pointer is on it, closes on Escape, and is skipped on touch screens.
- **The trash bag animates once per change and then rests**: the level rises with a little overshoot, the surface sloshes, the new item drops in, and the bag squashes.
  Nothing loops, and all of it is off under reduced motion.
- **There are no donations.**
  The Donate buttons and the planned Stripe phase were removed at the owner's request.
  The unused `donations` table stays in the applied migrations; dropping it needs a new migration.
- **The logo mark is an inline SVG traced from `public/brand/shore-up-logo.png`**, so it stays sharp and takes its color from the theme.

## Tooling

- pnpm, Vitest for unit tests, and Playwright for end-to-end checks.
- **End-to-end tests run against the real Supabase project** with throwaway accounts that are deleted afterwards.
  They run two at a time, because they share one dev server and a free-tier database, and the "core moment within 3 seconds" check should measure the app rather than contention between tests.
- **Map tests wait for the camera to arrive**, since the beach panel renders before the map style has loaded.
- The project was scaffolded in a lowercase temp folder, because npm rejects the capital letters in `Shore-Up`.
