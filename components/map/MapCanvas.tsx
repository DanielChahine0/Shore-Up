"use client";

import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";
import type { BeachSummary } from "@/lib/beaches";
import type { BeachDetail } from "@/lib/beachDetail";
import { FLIGHT_MS, globeView, NEUTRAL, SATELLITE_FADE, SPIN_DEG_PER_SEC, SPIN_MAX_ZOOM } from "./mapConfig";

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
  onReady: () => void;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapCanvas({ token, beaches, selectedId, detail, camera, padding, highlightZoneId, onSelectBeach, onZoneHover, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const readyRef = useRef(false);
  const spinningRef = useRef(true);
  const startSpinRef = useRef<() => void>(() => {});
  const latest = useRef({ onSelectBeach, onZoneHover, onReady, padding, selectedId, detail, camera });
  // Map event handlers outlive renders, so they read the newest props through this ref.
  useEffect(() => {
    latest.current = { onSelectBeach, onZoneHover, onReady, padding, selectedId, detail, camera };
  });

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = token;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startsOnBeach = latest.current.camera?.kind === "beach";
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
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
    startSpinRef.current = startSpin;
    const stopSpin = () => {
      spinningRef.current = false;
    };
    for (const evt of ["mousedown", "touchstart", "wheel"] as const) map.on(evt, stopSpin);

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(14, 36, 58)",
        "high-color": "rgb(44, 110, 180)",
        "horizon-blend": 0.05,
        "space-color": "rgb(3, 8, 15)",
        "star-intensity": 0.55,
      });

      // Tint the base style toward the ocean: navy water, slightly lighter land.
      if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "rgb(9, 30, 50)");
      if (map.getLayer("land")) map.setPaintProperty("land", "background-color", "rgb(22, 40, 56)");

      // Satellite imagery fades in by zoom. No style swap, so custom layers survive.
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addSource("satellite", { type: "raster", url: "mapbox://mapbox.satellite", tileSize: 256 });
      map.addLayer(
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          minzoom: SATELLITE_FADE.from,
          paint: {
            "raster-opacity": ["interpolate", ["linear"], ["zoom"], SATELLITE_FADE.from, 0, SATELLITE_FADE.to, 1],
            "raster-fade-duration": 300,
          },
        },
        firstSymbol,
      );

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
      // Beaches are neutral glowing dots. Only the selected beach ever shows scale colors.
      map.addLayer({
        id: "beach-glow",
        type: "circle",
        source: "beaches",
        paint: {
          "circle-color": NEUTRAL,
          "circle-radius": ["case", ["has", "point_count"], ["interpolate", ["linear"], ["get", "point_count"], 2, 20, 12, 30], 12],
          "circle-blur": 1,
          "circle-opacity": 0.4,
        },
      });
      map.addLayer({
        id: "beach-clusters",
        type: "circle",
        source: "beaches",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgb(12, 32, 51)",
          "circle-stroke-color": NEUTRAL,
          "circle-stroke-width": 1.5,
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 11, 12, 16],
        },
      });
      map.addLayer({
        id: "beach-cluster-count",
        type: "symbol",
        source: "beaches",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-allow-overlap": true },
        paint: { "text-color": NEUTRAL },
      });
      map.addLayer({
        id: "beach-dots",
        type: "circle",
        source: "beaches",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": NEUTRAL, "circle-radius": 4.5, "circle-stroke-color": "rgb(7, 19, 31)", "circle-stroke-width": 1.5 },
      });
      map.addLayer({
        id: "beach-names",
        type: "symbol",
        source: "beaches",
        filter: ["!", ["has", "point_count"]],
        minzoom: 8,
        layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.1], "text-anchor": "top", "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] },
        paint: { "text-color": NEUTRAL, "text-halo-color": "rgb(7, 19, 31)", "text-halo-width": 1.2 },
      });

      // Selected beach: zones on the cleanliness scale plus a glowing outline.
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
          "line-color": "rgb(7, 19, 31)",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.2],
          "line-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "outline-glow",
        type: "line",
        source: "outline",
        layout: { "line-join": "round" },
        paint: { "line-color": "rgb(143, 227, 208)", "line-width": 14, "line-blur": 12, "line-opacity": 0.75 },
      });
      map.addLayer({
        id: "outline-line",
        type: "line",
        source: "outline",
        layout: { "line-join": "round" },
        paint: { "line-color": "rgb(234, 244, 244)", "line-width": 2 },
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
        paint: { "text-color": "rgb(255, 255, 255)", "text-halo-color": "rgb(7, 19, 31)", "text-halo-width": 1.6 },
      });

      readyRef.current = true;
      applyDetail(map, latest.current.detail);
      applySelection(map, latest.current.selectedId);
      if (latest.current.camera) runCamera(map, latest.current.camera, latest.current.padding, false);
      latest.current.onReady();
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
    spinningRef.current = camera.kind === "globe";
    runCamera(map, camera, latest.current.padding, true);
    startSpinRef.current();
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
    map.setPaintProperty("zones-fill", "fill-opacity", 0.62);
  });
}

function runCamera(map: MapboxMap, camera: CameraCommand, padding: Props["padding"], animate: boolean) {
  const duration = animate ? FLIGHT_MS : 0;
  if (camera.kind === "globe") {
    map.flyTo({ ...globeView(window.innerWidth), duration, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
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
