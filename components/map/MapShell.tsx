"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DonateFab } from "@/components/chrome/DonateFab";
import { Logo } from "@/components/chrome/Logo";
import { SearchBar, type PlaceResult } from "@/components/chrome/SearchBar";
import { TopRight } from "@/components/chrome/TopRight";
import { BeachPanel, type PanelAction } from "@/components/panel/BeachPanel";
import { Toast } from "@/components/ui/Toast";
import type { BeachSummary } from "@/lib/beaches";
import type { BeachDetail } from "@/lib/beachDetail";
import { BackToGlobe } from "./BackToGlobe";
import { MapCanvas, type CameraCommand, type ZoneHover } from "./MapCanvas";
import { MissingToken } from "./MissingToken";
import { ZoneTooltip } from "./ZoneTooltip";

const SHEET_PEEK_PX = 264;
/** Short enough that the donate button and map attribution stay below the top bar. */
const SHEET_EXPANDED = "62dvh";
const PANEL_WIDTH_PX = 380 + 16;
const DESKTOP_QUERY = "(min-width: 640px)";

const PHASE_NOTES: Record<PanelAction, string> = {
  join: "Joining cleanups opens once sign-in is built (phase 2).",
  post: "Posting cleanups opens with Community News (phase 3).",
  donate: "Donations open with Stripe Checkout (phase 4).",
};

function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

type Props = { beaches: BeachSummary[]; mapboxToken: string; children: React.ReactNode };

export function MapShell({ beaches, mapboxToken, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  const selectedId = pathname.match(/^\/beach\/([^/]+)/)?.[1] ?? null;
  const selected = useMemo(() => beaches.find((b) => b.id === selectedId) ?? null, [beaches, selectedId]);

  const [loaded, setLoaded] = useState<{ id: string; detail: BeachDetail } | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [placeCamera, setPlaceCamera] = useState<CameraCommand | null>(null);
  const [hover, setHover] = useState<ZoneHover>(null);
  const [panelZoneId, setPanelZoneId] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasLeftGlobe, setHasLeftGlobe] = useState(false);

  // Only ever show data for the beach that is selected right now.
  const detail = loaded && loaded.id === selectedId ? loaded.detail : null;
  const error = failed && failed.id === selectedId ? failed.message : null;

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/beaches/${selectedId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "We don't have this beach yet." : "The beach score didn't load.");
        setLoaded({ id: selectedId, detail: (await res.json()) as BeachDetail });
        setFailed(null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setFailed({ id: selectedId, message: err.message });
      });
    return () => controller.abort();
  }, [selectedId, attempt]);

  // The camera follows the URL: a beach flies in, leaving a beach flies back out.
  const camera = useMemo<CameraCommand | null>(() => {
    if (selected) return { kind: "beach", bounds: selected.bounds };
    if (placeCamera) return placeCamera;
    return hasLeftGlobe ? { kind: "globe" } : null;
  }, [selected, placeCamera, hasLeftGlobe]);

  const padding = useMemo(
    () =>
      isDesktop
        ? { top: 76, right: selected ? PANEL_WIDTH_PX : 0, bottom: 0, left: 0 }
        : { top: 120, right: 0, bottom: selected ? SHEET_PEEK_PX : 0, left: 0 },
    [isDesktop, selected],
  );

  const selectBeach = useCallback(
    (id: string) => {
      setPlaceCamera(null);
      setHasLeftGlobe(true);
      setSheetExpanded(false);
      router.push(`/beach/${id}`);
    },
    [router],
  );

  const pickPlace = useCallback(
    (place: PlaceResult) => {
      setHasLeftGlobe(true);
      setPlaceCamera({ kind: "place", center: place.center, bounds: place.bounds });
      if (selectedId) router.push("/");
    },
    [router, selectedId],
  );

  const backToGlobe = useCallback(() => {
    setPlaceCamera(null);
    setHasLeftGlobe(true);
    if (selectedId) router.push("/");
  }, [router, selectedId]);

  const clearToast = useCallback(() => setToast(null), []);
  const markReady = useCallback(() => setMapReady(true), []);

  if (!mapboxToken) return <MissingToken />;

  const sheetOffset = !isDesktop && selected ? (sheetExpanded ? SHEET_EXPANDED : `${SHEET_PEEK_PX}px`) : "0px";
  const panelOffset = isDesktop && selected ? `${PANEL_WIDTH_PX + 8}px` : "0px";
  const activeZoneId = hover?.zoneId ?? panelZoneId;
  const hoveredZone = hover && detail ? detail.score.zones.find((z) => z.zoneId === hover.zoneId) : undefined;
  const awayFromGlobe = Boolean(selected || placeCamera);

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-abyss"
      style={{ "--sheet-offset": sheetOffset, "--panel-offset": panelOffset, "--sheet-peek": `${SHEET_PEEK_PX}px`, "--sheet-expanded": SHEET_EXPANDED } as React.CSSProperties}
    >
      <MapCanvas
        token={mapboxToken}
        beaches={beaches}
        selectedId={selectedId}
        detail={detail}
        camera={camera}
        padding={padding}
        highlightZoneId={panelZoneId}
        onSelectBeach={selectBeach}
        onZoneHover={setHover}
        onReady={markReady}
      />

      <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-4 transition-opacity duration-700 ${mapReady ? "opacity-100" : "opacity-0"}`}>
        <div className="pointer-events-auto order-1 flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <Logo />
          <div className="hidden min-w-0 sm:block">
            <SearchBar beaches={beaches} token={mapboxToken} onPickBeach={selectBeach} onPickPlace={pickPlace} />
          </div>
        </div>
        <div className="pointer-events-auto order-2">
          <TopRight />
        </div>
        <div className="pointer-events-auto order-3 flex w-full sm:hidden">
          <SearchBar beaches={beaches} token={mapboxToken} onPickBeach={selectBeach} onPickPlace={pickPlace} />
        </div>
        {awayFromGlobe && (
          <div className="pointer-events-auto order-4 w-full sm:absolute sm:left-4 sm:top-[76px] sm:w-auto">
            <BackToGlobe onClick={backToGlobe} />
          </div>
        )}
      </div>

      {hoveredZone && hover && <ZoneTooltip zone={hoveredZone} x={hover.x} y={hover.y} />}

      {selected && (
        <BeachPanel
          key={selected.id}
          beach={selected}
          score={detail?.score ?? null}
          error={error}
          activeZoneId={activeZoneId}
          expanded={sheetExpanded}
          onToggleExpanded={() => setSheetExpanded((v) => !v)}
          onFocusZone={setPanelZoneId}
          onAction={(action) => setToast(PHASE_NOTES[action])}
          onRetry={() => setAttempt((n) => n + 1)}
          onClose={backToGlobe}
        />
      )}

      <DonateFab onClick={() => setToast(PHASE_NOTES.donate)} />
      {toast && <Toast message={toast} onDone={clearToast} />}
      {children}
    </main>
  );
}
