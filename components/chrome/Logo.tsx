import Link from "next/link";

/** The Shore Up mark: a bottle on its side, traced from public/brand/shore-up-logo.png. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="441 459 1119 563" className={className} fill="currentColor" fillRule="evenodd" aria-hidden>
      <path d="M597 459H987L1070 496L1168 459H1560V1022H1170L1070 990L985 1022H597V856H441V625H597ZM738 607V875H961L1066 834L1191 875H1419V607H1192L1066 655L959 607ZM502 690V792H590V690Z" />
    </svg>
  );
}

/** White mark on the brand blue, with the wordmark beside it. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`glass flex h-11 shrink-0 items-center gap-2.5 rounded-full pl-1.5 ${compact ? "pr-1.5 sm:pr-4" : "pr-1.5 min-[370px]:pr-4"}`} aria-label="Shore Up home">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
        <LogoMark className="w-5" />
      </span>
      {/* On narrow headers the mark stands alone so the CN pill keeps its room. */}
      <span className={`text-[15px] font-bold uppercase tracking-wide text-ink ${compact ? "hidden sm:inline" : "hidden min-[370px]:inline"}`}>Shore Up</span>
    </Link>
  );
}
