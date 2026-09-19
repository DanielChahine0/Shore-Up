import { MapShell } from "@/components/map/MapShell";
import { listBeaches } from "@/lib/beaches";

/**
 * The map lives in this layout so it persists across / and /beach/[id]:
 * navigating between them moves the camera instead of remounting the globe.
 */
export default function MapLayout({ children }: LayoutProps<"/">) {
  return (
    <MapShell beaches={listBeaches()} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}>
      {children}
    </MapShell>
  );
}
