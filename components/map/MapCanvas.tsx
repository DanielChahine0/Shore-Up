"use client";

import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import type { BeachSummary } from "@/lib/beaches";
import type { BeachDetail } from "@/lib/beachDetail";
import { AWAY_FROM_GLOBE_ZOOM, FLIGHT_MS, globeView, KEPT_BASE_LAYERS, MAP_COLORS, SAND_MIN_ZOOM, SPIN_DEG_PER_SEC, SPIN_MAX_ZOOM } from "./mapConfig";

export type CameraCommand =
  | { kind: "beach"; bounds: [number, number, number, number] }
  | { kind: "place"; center: [number, number]; bounds?: [number, number, number, number] }
  | { kind: "globe" };

export type ZoneHover = { zoneId: string; x: number; y: number } | null;

type Props = {
  token: string;
  beaches: BeachSummary[];
  selectedId: string | null;
  detail: BeachDetail | null;
  /** A new object identity triggers a camera move. */
  camera: CameraCommand | null;
  /** Screen space covered by the panel, so flights frame the beach in the visible area. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** A zone focused from the panel, outlined on the map. */
  highlightZoneId: string | null;
  onSelectBeach: (id: string) => void;
  onZoneHover: (hover: ZoneHover) => void;
  /** Fires when the camera crosses between the whole-globe view and a zoomed-in view. */
  onAwayChange: (away: boolean) => void;
  onReady: () => void;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapCanvas({ token, beaches, selectedId, detail, camera, padding, highlightZoneId, onSelectBeach, onZoneHover, onAwayChange, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const readyRef = useRef(false);
  const spinningRef = useRef(true);
  const latest = useRef({ onSelectBeach, onZoneHover, onAwayChange, onReady, padding, selectedId, detail, camera });
  // Map event handlers outlive renders, so they read the newest props through this ref.
  useEffect(() => {
    latest.current = { onSelectBeach, onZoneHover, onAwayChange, onReady, padding, selectedId, detail, camera };
  });

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = token;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startsOnBeach = latest.current.camera?.kind === "beach";
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      ...globeView(window.innerWidth),
      attributionControl: false,
      logoPosition: "bottom-left",
    });
    mapRef.current = map;
    spinningRef.current = !startsOnBeach;
    // Handle for end-to-end tests and debugging. Never present in production builds.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __shoreMap?: MapboxMap }).__shoreMap = map;
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true, customAttribution: "Beach shapes © OpenStreetMap contributors" }),
      "bottom-right",
    );

    // The globe rotates until the user touches it. Rotation is timed per frame so the speed is exact.
    let spinFrame = 0;
    let lastTick = 0;
    const spin = (now: number) => {
      spinFrame = 0;
      if (!spinningRef.current) return;
      const dt = lastTick ? Math.min(now - lastTick, 100) / 1000 : 0;
      lastTick = now;
      if (!map.isMoving() && map.getZoom() <= SPIN_MAX_ZOOM) {
        const center = map.getCenter();
        center.lng -= SPIN_DEG_PER_SEC * dt;
        map.jumpTo({ center });
      }
      spinFrame = requestAnimationFrame(spin);
    };
    const startSpin = () => {
      if (spinFrame || !spinningRef.current || reducedMotion) return;
      lastTick = 0;
      spinFrame = requestAnimationFrame(spin);
    };
    const stopSpin = () => {
      spinningRef.current = false;
    };
    for (const evt of ["mousedown", "touchstart", "wheel"] as const) map.on(evt, stopSpin);

    // Checked on every zoom, at the end of every move, and once after the first camera placement,
    // so the state is right even when a jump happens before listeners or React state are ready.
    let away = false;
    const syncAway = () => {
      const next = map.getZoom() > AWAY_FROM_GLOBE_ZOOM;
      if (next === away) return;
      away = next;
      latest.current.onAwayChange(next);
    };
    map.on("zoom", syncAway);
    map.on("moveend", syncAway);

    map.on("style.load", () => {
      // A pale sky around the globe. No stars: the app is light mode only.
      map.setFog({
        color: "rgb(255, 255, 255)",
        "high-color": "rgb(169, 211, 223)",
        "horizon-blend": 0.04,
        "space-color": "rgb(241, 248, 250)",
        "star-intensity": 0,
      });

      // Beaches are the only detail. Everything else in the base style is hidden, not restyled,
      // so roads, buildings, land use, and points of interest never compete with a beach.
      for (const layer of map.getStyle().layers ?? []) {
        if (!KEPT_BASE_LAYERS.has(layer.id)) map.setLayoutProperty(layer.id, "visibility", "none");
      }
      map.setPaintProperty("land", "background-color", MAP_COLORS.land);
      map.setPaintProperty("water", "fill-color", ["interpolate", ["linear"], ["zoom"], 3, MAP_COLORS.waterFar, 11, MAP_COLORS.waterNear]);
      for (const id of ["admin-0-boundary", "admin-0-boundary-disputed"]) map.setPaintProperty(id, "line-color", MAP_COLORS.border);
      for (const id of ["country-label", "continent-label", "settlement-major-label"]) {
        map.setPaintProperty(id, "text-color", MAP_COLORS.ink);
        map.setPaintProperty(id, "text-halo-color", MAP_COLORS.white);
        map.setPaintProperty(id, "text-halo-width", 1.4);
      }

      // Every beach as a sand shape, drawn under the labels.
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addSource("sand", { type: "geojson", data: "/api/beaches/shapes" });
      map.addLayer({ id: "sand-fill", type: "fill", source: "sand", minzoom: SAND_MIN_ZOOM, paint: { "fill-color": MAP_COLORS.sand } }, firstSymbol);
      map.addLayer({ id: "sand-edge", type: "line", source: "sand", minzoom: SAND_MIN_ZOOM, paint: { "line-color": MAP_COLORS.sandEdge, "line-width": 1 } }, firstSymbol);

      map.addSource("beaches", {
        type: "geojson",
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 9,
        data: {
          type: "FeatureCollection",
          features: beaches.map((b) => ({
            type: "Feature",
            properties: { id: b.id, name: b.name },
            geometry: { type: "Point", coordinates: [b.lng, b.lat] },
          })),
        },
      });
      // Beaches are white dots ringed in deep blue, readable on land and sea. Only the selected beach ever shows scale colors.
      map.addLayer({
        id: "beach-glow",
        type: "circle",
        source: "beaches",
        paint: {
          "circle-color": MAP_COLORS.brandDeep,
          "circle-radius": ["case", ["has", "point_count"], ["interpolate", ["linear"], ["get", "point_count"], 2, 20, 12, 30], 12],
          "circle-blur": 1,
          "circle-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "beach-clusters",
        type: "circle",
        source: "beaches",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": MAP_COLORS.brandDeep,
          "circle-stroke-color": MAP_COLORS.white,
          "circle-stroke-width": 2,
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 11, 12, 16],
        },
      });
      map.addLayer({
        id: "beach-cluster-count",
        type: "symbol",
        source: "beaches",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-allow-overlap": true },
        paint: { "text-color": MAP_COLORS.white },
      });
      map.addLayer({
        id: "beach-dots",
        type: "circle",
        source: "beaches",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": MAP_COLORS.white, "circle-radius": 5, "circle-stroke-color": MAP_COLORS.brandDeep, "circle-stroke-width": 2.5 },
      });
      map.addLayer({
        id: "beach-names",
        type: "symbol",
        source: "beaches",
        filter: ["!", ["has", "point_count"]],
        minzoom: 8,
        layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.1], "text-anchor": "top", "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] },
        paint: { "text-color": MAP_COLORS.ink, "text-halo-color": MAP_COLORS.white, "text-halo-width": 1.6 },
      });

      // Selected beach: zones on the cleanliness scale inside a firm outline.
      map.addSource("zones", { type: "geojson", data: EMPTY, promoteId: "zoneId" });
      map.addSource("outline", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 900, delay: 0 },
        },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: {
          "line-color": MAP_COLORS.ink,
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.2],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "outline-glow",
        type: "line",
        source: "outline",
        layout: { "line-join": "round" },
        paint: { "line-color": MAP_COLORS.white, "line-width": 12, "line-blur": 8, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "outline-line",
        type: "line",
        source: "outline",
        layout: { "line-join": "round" },
        paint: { "line-color": MAP_COLORS.brandDeep, "line-width": 2.5 },
      });
      // Color is never the only signal: every zone carries its score on the map.
      map.addLayer({
        id: "zones-score",
        type: "symbol",
        source: "zones",
        layout: {
          "text-field": ["to-string", ["get", "score"]],
          "text-size": 14,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": MAP_COLORS.ink, "text-halo-color": MAP_COLORS.white, "text-halo-width": 1.8 },
      });

      readyRef.current = true;
      applyDetail(map, latest.current.detail);
      applySelection(map, latest.current.selectedId);
      if (latest.current.camera) runCamera(map, latest.current.camera, latest.current.padding, false);
      latest.current.onReady();
      syncAway();
      startSpin();
    });

    map.on("click", "beach-clusters", (e) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      if (clusterId == null || feature?.geometry.type !== "Point") return;
      // Fly to the area that holds every beach in the cluster, not just one zoom level in.
      (map.getSource("beaches") as GeoJSONSource).getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
        if (err || !leaves?.length) return;
        const bounds = new mapboxgl.LngLatBounds();
        for (const leaf of leaves) if (leaf.geometry.type === "Point") bounds.extend(leaf.geometry.coordinates as [number, number]);
        map.fitBounds(bounds, { padding: withMargin(latest.current.padding, 120), maxZoom: 12, duration: 2000 });
      });
    });
    map.on("click", "beach-dots", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) latest.current.onSelectBeach(id);
    });
    for (const layer of ["beach-clusters", "beach-dots", "zones-fill"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }

    // Hover (or tap) a zone for its details.
    let hovered: string | null = null;
    const setHovered = (zoneId: string | null, point?: { x: number; y: number }) => {
      if (hovered && hovered !== zoneId) map.setFeatureState({ source: "zones", id: hovered }, { hover: false });
      hovered = zoneId;
      if (zoneId) map.setFeatureState({ source: "zones", id: zoneId }, { hover: true });
      latest.current.onZoneHover(zoneId && point ? { zoneId, x: point.x, y: point.y } : null);
    };
    map.on("mousemove", "zones-fill", (e) => setHovered((e.features?.[0]?.properties?.zoneId as string) ?? null, e.point));
    map.on("mouseleave", "zones-fill", () => setHovered(null));
    map.on("click", (e) => {
      if (!map.getLayer("zones-fill")) return;
      const zone = map.queryRenderedFeatures(e.point, { layers: ["zones-fill"] })[0];
      setHovered((zone?.properties?.zoneId as string) ?? null, e.point);
    });
    map.on("movestart", () => hovered && setHovered(null));

    return () => {
      readyRef.current = false;
      cancelAnimationFrame(spinFrame);
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (mapRef.current && readyRef.current) applySelection(mapRef.current, selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (mapRef.current && readyRef.current) applyDetail(mapRef.current, detail);
  }, [detail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !camera) return;
    // Any camera command counts as the user taking control, so the idle rotation never resumes.
    spinningRef.current = false;
    runCamera(map, camera, latest.current.padding, true);
  }, [camera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !highlightZoneId) return;
    map.setFeatureState({ source: "zones", id: highlightZoneId }, { hover: true });
    return () => {
      if (mapRef.current && readyRef.current) map.setFeatureState({ source: "zones", id: highlightZoneId }, { hover: false });
    };
  }, [highlightZoneId]);

  // Mapbox's stylesheet forces `position: relative` on its container, so the sizing lives on a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" role="application" aria-label="Globe and beach map" />
    </div>
  );
}

function applySelection(map: MapboxMap, selectedId: string | null) {
  // The selected beach swaps its dot for the outline and zones.
  const unclustered: mapboxgl.FilterSpecification = ["!", ["has", "point_count"]];
  const filter: mapboxgl.FilterSpecification = selectedId ? ["all", unclustered, ["!=", ["get", "id"], selectedId]] : unclustered;
  map.setFilter("beach-dots", filter);
  map.setFilter("beach-names", filter);
}

function applyDetail(map: MapboxMap, detail: BeachDetail | null) {
  (map.getSource("zones") as GeoJSONSource).setData(detail?.zones ?? EMPTY);
  (map.getSource("outline") as GeoJSONSource).setData(detail?.outline ?? EMPTY);
  // Reset to transparent, then fade the new beach's zones in.
  map.setPaintProperty("zones-fill", "fill-opacity-transition", { duration: 0, delay: 0 });
  map.setPaintProperty("zones-fill", "fill-opacity", 0);
  if (!detail) return;
  requestAnimationFrame(() => {
    if (!map.getLayer("zones-fill")) return;
    map.setPaintProperty("zones-fill", "fill-opacity-transition", { duration: 900, delay: 0 });
    map.setPaintProperty("zones-fill", "fill-opacity", 0.85);
  });
}

function runCamera(map: MapboxMap, camera: CameraCommand, padding: Props["padding"], animate: boolean) {
  const duration = animate ? FLIGHT_MS : 0;
  if (camera.kind === "globe") {
    // Zoom out over wherever the user already is. Never reset to the starting view.
    map.flyTo({ ...globeView(window.innerWidth), center: map.getCenter(), duration, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
    return;
  }
  if (camera.bounds) {
    map.fitBounds(camera.bounds, { padding: withMargin(padding, 48), duration, maxZoom: 16.5, curve: 1.5 });
  } else if (camera.kind === "place") {
    map.flyTo({ center: camera.center, zoom: 11, duration, padding });
  }
}

function withMargin(p: Props["padding"], margin: number) {
  return { top: p.top + margin, right: p.right + margin, bottom: p.bottom + margin, left: p.left + margin };
}
