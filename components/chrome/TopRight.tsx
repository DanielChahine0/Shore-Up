"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useViewer } from "./useViewer";

/**
 * CN pill with the profile slot to its right. Signed-out users see "Sign in";
 * signed-in users see their avatar, which opens their profile.
 * The pill reads "CN: Join" until communities arrive in phase 3.
 */
export function TopRight() {
  const viewer = useViewer();
  return (
    <nav aria-label="Account" className="flex shrink-0 items-center gap-2">
      <Link href="/communities" className="glass flex h-11 items-center rounded-full px-4 text-sm text-shell">
        <span className="text-mist">CN:&nbsp;</span>
        <span className="font-medium">Join</span>
      </Link>
      {viewer === undefined ? (
        <span className="h-11 w-11" aria-hidden />
      ) : viewer ? (
        <Link href={`/profile/${viewer.username}`} aria-label={`Your profile, ${viewer.displayName}`} className="rounded-full ring-1 ring-line">
          <Avatar name={viewer.displayName} src={viewer.avatarUrl} size={44} />
        </Link>
      ) : (
        <Link href="/signin" className="flex h-11 items-center rounded-full bg-foam px-4 text-sm font-semibold text-foam-deep">
          Sign in
        </Link>
      )}
    </nav>
  );
}
