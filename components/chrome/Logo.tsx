import Link from "next/link";

/** Wordmark with a shoreline mark: sand arc above, water line below. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`glass flex h-11 shrink-0 items-center gap-2 rounded-full pl-3 ${compact ? "pr-3 sm:pr-4" : "pr-4"}`} aria-label="Shore Up home">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-foam" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M4 13a8 8 0 0 1 16 0" />
        <path d="M2.5 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 3-1.5" />
      </svg>
      {/* On narrow page headers the mark stands alone so the CN pill keeps its room. */}
      <span className={`text-[15px] font-semibold tracking-tight text-shell ${compact ? "hidden sm:inline" : ""}`}>Shore Up</span>
    </Link>
  );
}
