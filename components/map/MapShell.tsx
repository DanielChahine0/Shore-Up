"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/chrome/Logo";
import { SearchBar, type PlaceResult } from "@/components/chrome/SearchBar";
import { TopRight } from "@/components/chrome/TopRight";
import { useViewer } from "@/components/chrome/useViewer";
import { EventsButton, EventsMenu } from "@/components/events/EventsMenu";
import { CreateCleanupModal } from "@/components/modals/CreateCleanupModal";
import { NewPostModal } from "@/components/modals/NewPostModal";
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog";
import { achievementName } from "@/lib/achievements/config";
import { BeachPanel, type PanelAction } from "@/components/panel/BeachPanel";
import { TrashLogger } from "@/components/trash/TrashLogger";
import { Toast } from "@/components/ui/Toast";
import type { BeachSummary } from "@/lib/beaches";
import type { BeachDetail } from "@/lib/beachDetail";
import { MapCanvas, type CameraCommand, type ZoneHover } from "./MapCanvas";
import { MissingToken } from "./MissingToken";
import { ZoneTooltip } from "./ZoneTooltip";

const SHEET_PEEK_PX = 264;
/** Short enough that the map attribution stays below the top bar. */
const SHEET_EXPANDED = "62dvh";
const PANEL_WIDTH_PX = 380 + 16;
const DESKTOP_QUERY = "(min-width: 640px)";

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
  const viewer = useViewer();

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
  const [hosting, setHosting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const eventsButtonRef = useRef<HTMLButtonElement>(null);

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

  // A selected beach flies in. Leaving one moves nothing: the camera stays where the user is.
  const camera = useMemo<CameraCommand | null>(() => {
    if (selected) return { kind: "beach", bounds: selected.bounds };
    return placeCamera;
  }, [selected, placeCamera]);

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
      setSheetExpanded(false);
      router.push(`/beach/${id}`);
    },
    [router],
  );

  const pickPlace = useCallback(
    (place: PlaceResult) => {
      setPlaceCamera({ kind: "place", center: place.center, bounds: place.bounds });
      if (selectedId) router.push("/");
    },
    [router, selectedId],
  );

  /** Closes the beach panel and leaves the camera exactly where it is. */
  const closeBeach = useCallback(() => {
    setPlaceCamera(null);
    router.push("/");
  }, [router]);

  const onPanelAction = (action: PanelAction) => {
    const signIn = () => router.push(`/signin?next=${encodeURIComponent(`/beach/${selectedId}`)}`);
    if (action === "post") {
      if (!viewer) return signIn();
      // Posts go to a community's news feed, so joining one comes first.
      if (!viewer.community) return router.push("/communities");
      return setPosting(true);
    }
    const next = detail?.upcomingCleanups[0];
    // "Join a cleanup" goes to the next one here. With none planned, it offers to host.
    if (action === "join" && next) return router.push(`/cleanups/${next.id}`);
    if (!viewer) return signIn();
    setHosting(true);
  };

  const clearToast = useCallback(() => setToast(null), []);
  const closeEvents = useCallback(() => setEventsOpen(false), []);
  const markReady = useCallback(() => setMapReady(true), []);

  if (!mapboxToken) return <MissingToken />;

  const sheetOffset = !isDesktop && selected ? (sheetExpanded ? SHEET_EXPANDED : `${SHEET_PEEK_PX}px`) : "0px";
  const panelOffset = isDesktop && selected ? `${PANEL_WIDTH_PX + 8}px` : "0px";
  const activeZoneId = hover?.zoneId ?? panelZoneId;
  const hoveredZone = hover && detail ? detail.score.zones.find((z) => z.zoneId === hover.zoneId) : undefined;

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-wash"
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
        <div className="pointer-events-auto order-2 flex min-w-0 items-center gap-2">
          <EventsButton open={eventsOpen} onOpen={() => setEventsOpen(true)} buttonRef={eventsButtonRef} />
          <TopRight />
        </div>
        <div className="pointer-events-auto order-3 flex w-full sm:hidden">
          <SearchBar beaches={beaches} token={mapboxToken} onPickBeach={selectBeach} onPickPlace={pickPlace} />
        </div>
      </div>

      {hoveredZone && hover && <ZoneTooltip zone={hoveredZone} x={hover.x} y={hover.y} />}

      {selected && (
        <BeachPanel
          key={selected.id}
          beach={selected}
          score={detail?.score ?? null}
          upcomingCleanups={detail?.upcomingCleanups ?? []}
          recentPosts={detail?.recentPosts ?? []}
          error={error}
          activeZoneId={activeZoneId}
          expanded={sheetExpanded}
          onToggleExpanded={() => setSheetExpanded((v) => !v)}
          onFocusZone={setPanelZoneId}
          onAction={onPanelAction}
          onRetry={() => setAttempt((n) => n + 1)}
          onClose={closeBeach}
        />
      )}

      {hosting && selected && detail && <CreateCleanupModal beach={selected} zones={detail.score.zones} onClose={() => setHosting(false)} />}

      {posting && selected && detail && viewer?.community && (
        <NewPostModal
          communities={[viewer.community]}
          beaches={beaches.map((b) => ({ id: b.id, name: b.name, area: b.area }))}
          initialBeachId={selected.id}
          // Start on the zone the user was looking at, or the one a cleanup would help most
          // (unsafe water is not something a cleanup can fix, so those come last).
          initialZoneId={activeZoneId ?? [...detail.score.zones].sort((a, b) => Number(a.unsafeOverride) - Number(b.unsafeOverride) || a.score - b.score)[0]?.zoneId}
          onClose={() => setPosting(false)}
          onPosted={({ newAchievements }) => {
            setPosting(false);
            setToast(newAchievements.length > 0 ? `Badge earned: ${newAchievements.map(achievementName).join(", ")}` : "Posted. Litter in that zone is now low.");
            // Reload this beach so the zone changes color right away.
            setAttempt((n) => n + 1);
          }}
        />
      )}

      {/* Each of these owns its own buttons, panels, and dialogs. */}
      <EventsMenu open={eventsOpen} onClose={closeEvents} triggerRef={eventsButtonRef} signedIn={Boolean(viewer)} onPickBeach={selectBeach} onToast={setToast} />
      <TrashLogger beach={selected ? { id: selected.id, name: selected.name } : null} signedIn={Boolean(viewer)} onToast={setToast} />
      <WelcomeDialog mapboxToken={mapboxToken} signedIn={Boolean(viewer)} onPickPlace={pickPlace} />
      {toast && <Toast message={toast} onDone={clearToast} />}
      {children}
    </main>
  );
}
