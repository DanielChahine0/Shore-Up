import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { BeachSummary } from "./beaches";
import type { BeachScore } from "./scores/types";

/** Everything the map and panel need for one selected beach. */
export type BeachDetail = {
  beach: BeachSummary;
  outline: Feature<Polygon | MultiPolygon>;
  /** Zone polygons with score, band, and color merged into properties for map styling. */
  zones: FeatureCollection<Polygon | MultiPolygon>;
  score: BeachScore;
};
