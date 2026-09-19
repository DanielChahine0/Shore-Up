import Link from "next/link";
import { Logo } from "./Logo";
import { TopRight } from "./TopRight";

/** Header for every page that is not the map. Same corners as the map: logo left, CN pill and avatar right. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-wash/85 p-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Logo compact />
        <nav aria-label="Sections" className="flex items-center text-sm">
          <Link href="/people" className="rounded-full px-2 py-2 min-[370px]:px-3 text-ink-soft hover:text-ink">
            People
          </Link>
          <Link href="/communities" className="hidden rounded-full px-3 py-2 text-ink-soft hover:text-ink sm:block">
            Communities
          </Link>
        </nav>
      </div>
      <TopRight />
    </header>
  );
}
