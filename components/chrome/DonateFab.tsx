import { HeartIcon } from "@/components/ui/icons";

/** Small round donate button, bottom right, sitting above the map attribution. */
export function DonateFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Donate"
      className="glass absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full text-foam transition-[bottom] duration-300 hover:text-shell"
      style={{ bottom: "calc(var(--sheet-offset, 0px) + 44px)" }}
    >
      <HeartIcon className="h-5 w-5" />
    </button>
  );
}
