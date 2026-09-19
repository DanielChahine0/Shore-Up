"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CommunityIcon } from "@/components/ui/icons";
import { useViewer } from "./useViewer";

/**
 * Community button with the profile slot to its right.
 * The button opens the user's community feed, or the list of communities when they
 * have not joined one. It is an icon, so its name lives in the label and the tooltip.
 * The avatar opens the profile; signed-out users see "Sign in" instead.
 */
export function TopRight() {
  const viewer = useViewer();
  const community = viewer?.community ?? null;
  return (
    <nav aria-label="Account" className="flex min-w-0 shrink items-center gap-2">
      <Link
        href={community ? `/cn/${community.slug}` : "/communities"}
        aria-label={community ? `Your community: ${community.name}` : "Join a community"}
        title={community ? community.name : "Join a community"}
        className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-strong transition-colors hover:text-brand-deep"
      >
        <CommunityIcon className="h-[22px] w-[22px]" />
      </Link>
      {viewer === undefined ? (
        <span className="h-11 w-11 shrink-0" aria-hidden />
      ) : viewer ? (
        <Link href={`/profile/${viewer.username}`} aria-label={`Your profile, ${viewer.displayName}`} className="shrink-0 rounded-full ring-1 ring-line">
          <Avatar name={viewer.displayName} src={viewer.avatarUrl} size={44} />
        </Link>
      ) : (
        <Link href="/signin" className="flex h-11 shrink-0 items-center rounded-full bg-brand-strong px-4 text-sm font-semibold text-white">
          Sign in
        </Link>
      )}
    </nav>
  );
}
