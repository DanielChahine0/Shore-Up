"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCleanup, type CreateCleanupState } from "@/app/actions/cleanups";
import { CloseIcon } from "@/components/ui/icons";
import type { BeachSummary } from "@/lib/beaches";
import type { ZoneScore } from "@/lib/scores/types";

const field = "mt-1 w-full rounded-xl border border-line bg-navy px-3 text-sm text-shell";

type Props = { beach: BeachSummary; zones: ZoneScore[]; onClose: () => void };

export function CreateCleanupModal({ beach, zones, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<CreateCleanupState, FormData>(createCleanup, {});
  const [localTime, setLocalTime] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  // The picker works in the visitor's own time zone; the server gets an exact instant.
  const instant = localTime && !Number.isNaN(new Date(localTime).getTime()) ? new Date(localTime).toISOString() : "";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="create-cleanup-title"
      className="glass glass-panel m-auto w-[min(92vw,420px)] rounded-3xl p-0 text-shell backdrop:bg-abyss/70"
    >
      <form action={action} className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="create-cleanup-title" className="text-lg font-semibold tracking-tight">
              Host a cleanup
            </h2>
            <p className="text-sm text-mist">{beach.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-full p-1.5 text-mist hover:text-shell">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <input type="hidden" name="beach_id" value={beach.id} />
        <input type="hidden" name="starts_at" value={instant} />

        <label className="mt-5 block text-sm">
          Date and time
          <input type="datetime-local" required value={localTime} onChange={(e) => setLocalTime(e.target.value)} className={`${field} h-11 [color-scheme:dark]`} />
        </label>
        <label className="mt-3 block text-sm">
          Zone
          <select name="zone_id" defaultValue="" className={`${field} h-11`}>
            <option value="">Whole beach</option>
            {zones.map((z) => (
              <option key={z.zoneId} value={z.zoneId}>
                {z.name} ({z.score}, {z.label})
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          Notes for volunteers
          <textarea name="notes" rows={3} maxLength={1000} placeholder="Where to meet, what to bring" className={`${field} py-2.5 placeholder:text-mist`} />
        </label>

        {state.error && (
          <p role="alert" className="mt-3 rounded-xl border border-line bg-navy px-3 py-2 text-sm">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="mt-5 h-11 w-full rounded-full bg-foam text-sm font-semibold text-foam-deep disabled:opacity-60">
          {pending ? "Saving" : "Create cleanup"}
        </button>
      </form>
    </dialog>
  );
}
