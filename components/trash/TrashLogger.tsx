"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { saveCleanSession } from "@/app/actions/sessions";
import { DonateFab } from "@/components/chrome/DonateFab";
import { TRASH_ITEMS, totalItems, type TrashItemKey } from "@/lib/trash/config";
import { TrashSheet } from "./TrashSheet";
import { BagIcon } from "./icons";
import { finishMessage, itemLabel, unlockProgress, type CleanSession } from "./session";
import { useCleanSession } from "./useCleanSession";

export type TrashLoggerProps = {
  /** The beach open on the map, if any, so a session can be tied to it. */
  beach: { id: string; name: string } | null;
  signedIn: boolean;
  onToast: (message: string) => void;
  onDonate: () => void;
};

const ITEM_NAMES = new Map<TrashItemKey, string>(TRASH_ITEMS.map((item) => [item.key, item.name]));

/** Bottom-right "Log trash" button and the clean session sheet. */
export function TrashLogger({ beach, signedIn, onToast, onDonate }: TrashLoggerProps) {
  const { session, pending, restored, start, adjust, clear, holdForSignIn, dropPending } = useCleanSession();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [justFinished, setJustFinished] = useState<CleanSession | null>(null);
  const [saving, startSaving] = useTransition();

  const running = totalItems(session?.counts ?? {});

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setJustFinished(null);
    setAnnouncement("");
    triggerRef.current?.focus();
  }, []);

  const onStart = () => {
    start(beach);
    setError(null);
    setAnnouncement("Session started. Nothing in the bag yet.");
  };

  /**
   * One announcement per tap, carrying both the item and the running total, so a
   * screen reader gets the whole picture without twelve competing live regions.
   */
  const onAdjust = (key: TrashItemKey, delta: number) => {
    const updated = adjust(key, delta);
    if (!updated) return;
    const counts = updated.counts;
    const total = totalItems(counts);
    const next = counts[key] ?? 0;
    const progress = unlockProgress(counts);
    const unlock = progress.unlocked ? "Badges and levels unlocked." : `${progress.remaining} more to unlock badges.`;
    setAnnouncement(`${ITEM_NAMES.get(key)}: ${next}. ${itemLabel(total)} in the bag. ${unlock}`);
  };

  const onDiscard = () => {
    clear();
    setError(null);
    setAnnouncement("Session discarded.");
  };

  const saveOne = (entry: CleanSession, onSaved: () => void) => {
    setError(null);
    startSaving(async () => {
      const result = await saveCleanSession({ startedAt: entry.startedAt, items: entry.counts, beachId: entry.beachId });
      if (!result.ok) {
        // Keep the session either way, so a failed save never costs someone their tally.
        setError(result.error);
        return;
      }
      onSaved();
      onToast(finishMessage(result.result));
    });
  };

  const onFinish = () => {
    if (!session || running === 0) return;
    if (!signedIn) {
      // Guests keep the session on the device and are asked to sign in.
      const held = holdForSignIn();
      if (!held) return;
      setJustFinished(held);
      setAnnouncement(`Session finished with ${itemLabel(totalItems(held.counts))}. Sign in to save it.`);
      return;
    }
    saveOne(session, () => {
      clear();
      close();
    });
  };

  const onSavePending = (entry: CleanSession) => saveOne(entry, () => dropPending(entry.startedAt));

  return (
    <>
      <div
        className="absolute z-10 flex flex-col items-end gap-3 transition-[bottom,right] duration-300"
        style={{ bottom: "calc(var(--sheet-offset, 0px) + 44px)", right: "calc(var(--panel-offset, 0px) + 16px)" }}
      >
        <DonateFab onClick={onDonate} />
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
          className="glass flex h-12 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-semibold text-shell transition-colors hover:text-foam"
        >
          <BagIcon className="h-5 w-5 text-foam" />
          Log trash
          {restored && running > 0 && (
            <span className="rounded-full bg-foam px-2 py-0.5 text-xs font-semibold text-foam-deep">
              {running}
              <span className="sr-only"> items in this session</span>
            </span>
          )}
        </button>
      </div>

      {open && (
        <TrashSheet
          beach={beach}
          signedIn={signedIn}
          session={session}
          pending={pending}
          justFinished={justFinished}
          saving={saving}
          error={error}
          announcement={announcement}
          onStart={onStart}
          onAdjust={onAdjust}
          onDiscard={onDiscard}
          onFinish={onFinish}
          onSavePending={onSavePending}
          onClose={close}
        />
      )}
    </>
  );
}
