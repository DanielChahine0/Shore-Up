"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { totalItems, type TrashItemKey } from "@/lib/trash/config";
import { ItemGrid } from "./ItemGrid";
import { BagTotal, TrashBag } from "./TrashBag";
import { CheckIcon } from "./icons";
import { itemLabel, unlockProgress, type CleanSession } from "./session";

const primary = "h-11 w-full rounded-full bg-brand-strong text-sm font-semibold text-white disabled:opacity-60";
const quiet = "h-11 rounded-full border border-line-strong px-4 text-sm font-medium text-ink hover:bg-tint";

export type TrashSheetProps = {
  beach: { id: string; name: string } | null;
  signedIn: boolean;
  session: CleanSession | null;
  /** Finished sessions a guest has not been able to save yet. */
  pending: CleanSession[];
  /** The session just finished by a guest, shown with the sign-in prompt. */
  justFinished: CleanSession | null;
  saving: boolean;
  error: string | null;
  announcement: string;
  onStart: () => void;
  onAdjust: (key: TrashItemKey, delta: number) => void;
  onDiscard: () => void;
  onFinish: () => void;
  onSavePending: (session: CleanSession) => void;
  onClose: () => void;
};

/** Bottom sheet on phones, panel anchored bottom right on desktop. */
export function TrashSheet(props: TrashSheetProps) {
  const { beach, signedIn, session, pending, justFinished, saving, error, announcement, onStart, onAdjust, onDiscard, onFinish, onSavePending, onClose } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Move focus into the sheet when it opens. TrashLogger puts it back on the button on close.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const counts = session?.counts ?? {};
  const progress = unlockProgress(counts);
  const canFinish = progress.total > 0;

  return (
    <>
      {/*
        A tap outside closes the sheet on phones, where it covers the map. It is a
        redundant pointer affordance, so it stays out of the tab order and out of
        the accessibility tree: Escape and the close button both do the same job.
      */}
      <button type="button" aria-hidden tabIndex={-1} onClick={onClose} className="fixed inset-0 z-20 cursor-default bg-wash/50 sm:hidden" />

      <section
        aria-label="Clean session"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        // Desktop sits just above the Log trash button, which stays where it is; the offsets keep
        // it clear of the beach panel and the map attribution.
        // Fully opaque: the beach panel sits underneath on phones and must not show through.
        style={{ background: "var(--color-surface)" }}
        className="glass glass-panel fade-in fixed inset-x-0 bottom-0 z-20 flex max-h-[86dvh] flex-col rounded-t-3xl sm:absolute sm:inset-x-auto sm:bottom-[calc(var(--sheet-offset,0px)+104px)] sm:right-[calc(var(--panel-offset,0px)+16px)] sm:max-h-[min(calc(100dvh-196px),720px)] sm:w-[380px] sm:rounded-3xl sm:transition-[bottom,right] sm:duration-300"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div className="min-w-0">
            <h2 ref={headingRef} tabIndex={-1} className="rounded text-lg font-semibold tracking-tight text-ink outline-offset-2">
              {justFinished ? "Session finished" : session ? "Clean session" : "Start a clean session"}
            </h2>
            {beach && !justFinished && <p className="mt-1 truncate text-sm text-ink-soft">at {beach.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close clean session" className="-mr-1.5 shrink-0 rounded-full p-1.5 text-ink-soft hover:text-ink">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-3">
          {/* One polite announcement per change, carrying both the item and the new total. */}
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>

          {justFinished ? (
            <GuestFinish session={justFinished} onClose={onClose} />
          ) : session ? (
            <>
              <div className="flex items-center gap-4">
                <TrashBag counts={counts} />
                <div className="min-w-0">
                  <BagTotal counts={counts} />
                  <p className="sr-only">{itemLabel(progress.total)} in the bag</p>
                  <UnlockProgress progress={progress} />
                </div>
              </div>

              <ItemGrid counts={counts} onAdjust={onAdjust} />
            </>
          ) : (
            <StartScreen beach={beach} signedIn={signedIn} pending={pending} saving={saving} error={error} onStart={onStart} onSavePending={onSavePending} />
          )}
        </div>

        {/* Outside the scrolling list, so finishing never means scrolling past twelve items. */}
        {session && !justFinished && (
          <footer className="shrink-0 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {error && (
              <p role="alert" className="mb-3 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink">
                {error}
              </p>
            )}
            {confirmDiscard ? (
              <>
                <p className="text-center text-sm text-ink">Throw this session away?</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Reset first, so the next session does not open on this question.
                      setConfirmDiscard(false);
                      onDiscard();
                    }}
                    className={quiet}
                  >
                    Yes
                  </button>
                  <button type="button" onClick={() => setConfirmDiscard(false)} className={quiet}>
                    Keep
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={onFinish} disabled={!canFinish || saving} className={primary}>
                  {saving ? "Saving" : "Finish session"}
                </button>
                {!canFinish && <p className="mt-2 text-center text-xs text-ink-soft">Log at least one item to finish.</p>}
                <button type="button" onClick={() => setConfirmDiscard(true)} className={`${quiet} mt-3 w-full`}>
                  Discard session
                </button>
              </>
            )}
          </footer>
        )}
      </section>
    </>
  );
}

function UnlockProgress({ progress }: { progress: ReturnType<typeof unlockProgress> }) {
  if (progress.unlocked) {
    return (
      <p className="fade-in mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-strong px-3 py-1 text-xs font-semibold text-white">
        <CheckIcon className="h-4 w-4" />
        Badges and levels unlocked
      </p>
    );
  }
  return (
    <div className="mt-2">
      <p className="text-sm text-ink-soft">
        {progress.total} of {progress.needed} to unlock badges
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.needed}
        aria-valuenow={progress.total}
        aria-valuetext={`${progress.total} of ${progress.needed} items toward badges`}
        className="mt-1.5 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-tint"
      >
        <div className="h-full rounded-full bg-brand-strong transition-[width] duration-300 ease-out" style={{ width: `${(progress.total / progress.needed) * 100}%` }} />
      </div>
    </div>
  );
}

type StartProps = Pick<TrashSheetProps, "beach" | "signedIn" | "pending" | "saving" | "error" | "onStart" | "onSavePending">;

function StartScreen({ beach, signedIn, pending, saving, error, onStart, onSavePending }: StartProps) {
  return (
    <>
      <p className="text-sm leading-relaxed text-ink">
        Tally what you pick up as you go. {beach ? `This one counts for ${beach.name}.` : "Open a beach on the map first if you want it counted there."}
      </p>
      <p className="mt-2 text-sm text-ink-soft">Five items in one session unlocks badges and levels.</p>

      {pending.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
          <p className="text-sm text-ink">
            {pending.length === 1 ? "You have one session" : `You have ${pending.length} sessions`} waiting to be saved.
          </p>
          <ul className="mt-2 space-y-2">
            {pending.map((entry) => (
              <li key={entry.startedAt} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">
                  {itemLabel(totalItems(entry.counts))}
                  {entry.beachName ? ` at ${entry.beachName}` : ""}
                </span>
                {signedIn ? (
                  <button type="button" onClick={() => onSavePending(entry)} disabled={saving} className="h-11 rounded-full border border-brand-strong/60 px-4 text-sm font-semibold text-brand-strong disabled:opacity-60">
                    {saving ? "Saving" : "Save it"}
                  </button>
                ) : (
                  <Link href="/signin?next=/" className="flex h-11 items-center rounded-full border border-brand-strong/60 px-4 text-sm font-semibold text-brand-strong">
                    Sign in to save
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <button type="button" onClick={onStart} className={`${primary} mt-5`}>
        Start session
      </button>
      {!signedIn && <p className="mt-2 text-center text-xs text-ink-soft">You can run a session as a guest. Signing in afterwards saves it.</p>}
    </>
  );
}

function GuestFinish({ session, onClose }: { session: CleanSession; onClose: () => void }) {
  const total = totalItems(session.counts);
  return (
    <>
      <div className="flex items-center gap-4">
        <TrashBag counts={session.counts} />
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-ink">{itemLabel(total)}</p>
          <p className="mt-1 text-sm text-ink-soft">collected{session.beachName ? ` at ${session.beachName}` : ""}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink">
        Nice work. This session is kept on this device. Sign in to save it to your profile and earn badges for it.
      </p>
      <Link href="/signin?next=/" className={`${primary} mt-5 flex items-center justify-center`}>
        Sign in to save it
      </Link>
      <button type="button" onClick={onClose} className={`${quiet} mt-3 w-full`}>
        Not now
      </button>
    </>
  );
}
