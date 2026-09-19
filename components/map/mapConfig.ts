/** Camera and style constants for the globe. */

/** The whole globe, sized to fit the viewport: phones need a lower zoom to show the full sphere. */
export function globeView(viewportWidth: number) {
  return { center: [-40, 28] as [number, number], zoom: viewportWidth < 640 ? 0.7 : 1.6, pitch: 0, bearing: 0 };
}

/** Camera flights take 2 to 3 seconds. */
export const FLIGHT_MS = 2600;

/** Idle rotation: one full turn in about two minutes. */
export const SPIN_DEG_PER_SEC = 3;
export const SPIN_MAX_ZOOM = 4;

/**
 * Map palette: light grey-green land and the brand blue sea, so beaches are the only detail.
 * The sea stays darker than the land at every zoom, so the coastline never fades out.
 * None of these is a cleanliness-scale color.
 */
export const MAP_COLORS = {
  land: "#afd0d2",
  /** The logo blue from far away, easing a little lighter up close so zone colors stand out against it. */
  waterFar: "#499ab2",
  waterNear: "#5ea6bc",
  sand: "#f0dfb8",
  sandEdge: "#a8863f",
  ink: "#0f2f3a",
  brandDeep: "#1d5467",
  white: "#ffffff",
  border: "#4f7f8c",
};

/** Base-style layers that stay visible. Roads, buildings, land use, points of interest, and minor labels are all hidden. */
export const KEPT_BASE_LAYERS = new Set(["land", "water", "admin-0-boundary", "admin-0-boundary-disputed", "country-label", "continent-label", "settlement-major-label"]);

/** Beach sand shapes appear once dots alone stop being enough. */
export const SAND_MIN_ZOOM = 9;
