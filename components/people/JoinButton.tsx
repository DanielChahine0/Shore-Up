"use client";

import { useState, useTransition } from "react";
import { joinCleanup, leaveCleanup } from "@/app/actions/cleanups";

type Props = { cleanupId: string; returnTo: string; joined?: boolean; size?: "sm" | "lg" };

export function JoinButton({ cleanupId, returnTo, joined = false, size = "sm" }: Props) {
  const [pending, startTransition] = useTransition();
  const [isJoined, setIsJoined] = useState(joined);
  const [message, setMessage] = useState<string | null>(null);

  const onClick = () =>
    startTransition(async () => {
      const result = isJoined ? await leaveCleanup(cleanupId) : await joinCleanup(cleanupId, returnTo);
      if (result.ok) setIsJoined(!isJoined);
      setMessage(result.ok ? result.message : result.error);
    });

  const sizing = size === "lg" ? "h-11 px-6 text-sm" : "h-9 px-4 text-[13px]";
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`rounded-full font-semibold disabled:opacity-60 ${sizing} ${isJoined ? "border border-line text-shell" : "bg-foam text-foam-deep"}`}
      >
        {pending ? "One moment" : isJoined ? "Leave cleanup" : "Join"}
      </button>
      {message && (
        <span role="status" className="max-w-56 text-right text-xs text-mist">
          {message}
        </span>
      )}
    </span>
  );
}
