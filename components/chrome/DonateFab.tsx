import { HeartIcon } from "@/components/ui/icons";

/**
 * Small round donate button. TrashLogger places it, stacked directly above the
 * "Log trash" button in the bottom-right corner of the map.
 */
export function DonateFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Donate"
      className="glass flex h-12 w-12 items-center justify-center rounded-full text-brand-strong transition-colors hover:text-ink"
    >
      <HeartIcon className="h-5 w-5" />
    </button>
  );
}
