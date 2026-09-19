"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useViewer } from "./useViewer";

/**
 * CN pill with the profile slot to its right.
 * The pill reads "CN: " plus the user's community and opens its feed, or "CN: Join"
 * and opens the list of communities. The avatar opens the profile; signed-out
 * users see "Sign in" instead.
 */
export function TopRight() {
  const viewer = useViewer();
  const community = viewer?.community ?? null;
  return (
    <nav aria-label="Account" className="flex min-w-0 shrink items-center gap-2">
      <Link
        href={community ? `/cn/${community.slug}` : "/communities"}
        aria-label={community ? `CN: ${community.name}` : "CN: Join"}
        className="glass flex h-11 min-w-0 max-w-[46vw] items-center rounded-full px-4 text-sm text-shell sm:max-w-xs"
      >
        <span className="shrink-0 text-mist">CN:&nbsp;</span>
        <span className="truncate font-medium">{community ? community.name : "Join"}</span>
      </Link>
      {viewer === undefined ? (
        <span className="h-11 w-11 shrink-0" aria-hidden />
      ) : viewer ? (
        <Link href={`/profile/${viewer.username}`} aria-label={`Your profile, ${viewer.displayName}`} className="shrink-0 rounded-full ring-1 ring-line">
          <Avatar name={viewer.displayName} src={viewer.avatarUrl} size={44} />
        </Link>
      ) : (
        <Link href="/signin" className="flex h-11 shrink-0 items-center rounded-full bg-foam px-4 text-sm font-semibold text-foam-deep">
          Sign in
        </Link>
      )}
    </nav>
  );
}
