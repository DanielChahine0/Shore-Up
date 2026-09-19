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

/** Satellite imagery is invisible at `from` and fully opaque at `to`. */
export const SATELLITE_FADE = { from: 10, to: 13.5 };

/** Beach dots, clusters, and labels. Never a cleanliness-scale color. */
export const NEUTRAL = "rgb(234, 244, 244)";
