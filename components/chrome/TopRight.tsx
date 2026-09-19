import Link from "next/link";

/**
 * CN pill with the profile slot to its right. Signed-out state for now:
 * "CN: Join" and "Sign in". Auth and communities arrive in phases 2 and 3.
 */
export function TopRight() {
  return (
    <nav aria-label="Account" className="flex shrink-0 items-center gap-2">
      <Link href="/communities" className="glass flex h-11 items-center rounded-full px-4 text-sm text-shell">
        <span className="text-mist">CN:&nbsp;</span>
        <span className="font-medium">Join</span>
      </Link>
      <Link href="/signin" className="flex h-11 items-center rounded-full bg-foam px-4 text-sm font-semibold text-foam-deep">
        Sign in
      </Link>
    </nav>
  );
}
