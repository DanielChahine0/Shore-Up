"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinCleanup, leaveCleanup } from "@/app/actions/cleanups";
import { track } from "@/lib/analytics/track";

type Props = {
  cleanupId: string;
  returnTo: string;
  /** Whether the viewer is already registered. */
  joined?: boolean;
  /** Signed-out visitors get a link to sign in instead of a button that cannot work. */
  signedIn?: boolean;
  size?: "sm" | "lg";
  /** Fires on the optimistic change and again if it rolls back, so a card can move its own count. */
  onChange?: (joined: boolean) => void;
  /** Fires once the server agrees, for a toast. Errors stay inline either way. */
  onDone?: (message: string) => void;
};

/**
 * The one button that registers a volunteer for a cleanup with the details they
 * already gave us, and cancels it again. It updates at once and rolls back if
 * the save fails, so the list never lies about what happened.
 */
export function JoinButton({ cleanupId, returnTo, joined = false, signedIn = true, size = "sm", onChange, onDone }: Props) {
  const [pending, startTransition] = useTransition();
  const [isJoined, setIsJoined] = useState(joined);
  const [error, setError] = useState<string | null>(null);

  // Both sizes keep a 44px target; the larger one just gets more room around the label.
  const sizing = size === "lg" ? "h-11 px-6 text-sm" : "h-11 px-4 text-[13px]";

  if (!signedIn) {
    return (
      <Link href={`/signin?next=${encodeURIComponent(returnTo)}`} className={`inline-flex items-center rounded-full bg-brand-strong font-semibold text-white ${sizing}`}>
        Sign in to register
      </Link>
    );
  }

  const toggle = () => {
    const next = !isJoined;
    setIsJoined(next);
    setError(null);
    onChange?.(next);
    startTransition(async () => {
      const result = next ? await joinCleanup(cleanupId, returnTo) : await leaveCleanup(cleanupId);
      if (result.ok) {
        track(next ? "event_registered" : "event_cancelled");
        return onDone?.(result.message);
      }
      setIsJoined(!next);
      onChange?.(!next);
      setError(result.error);
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isJoined}
        aria-label={isJoined ? "Cancel your registration" : "Register for this cleanup"}
        className={`rounded-full font-semibold disabled:opacity-60 ${sizing} ${isJoined ? "border border-line text-ink" : "bg-brand-strong text-white"}`}
      >
        {isJoined ? "Cancel" : "Register"}
      </button>
      {error && (
        <span role="alert" className="max-w-56 text-right text-xs text-ink">
          {error}
        </span>
      )}
    </span>
  );
}
