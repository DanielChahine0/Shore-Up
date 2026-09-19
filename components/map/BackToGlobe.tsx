import { GlobeIcon } from "@/components/ui/icons";

export function BackToGlobe({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="glass fade-in flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink">
      <GlobeIcon className="h-4 w-4 text-brand-strong" />
      Back to globe
    </button>
  );
}
