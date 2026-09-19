"use client";

import { useState, useTransition } from "react";
import { checkInAttendee, undoCheckIn } from "@/app/actions/cleanups";
import { Avatar } from "@/components/ui/Avatar";
import type { CheckInEntry } from "@/lib/cleanups/queries";

/** Volunteers with a private profile are still checked in, just without a name. */
function nameFor(entry: CheckInEntry): string {
  return entry.displayName ?? "A volunteer";
}

type Props = { cleanupId: string; roster: CheckInEntry[] };

/** The organizer's end-of-event tally: who came, and how much each of them collected. */
export function CheckInList({ cleanupId, roster }: Props) {
  return (
    <ul className="mt-4 grid gap-3">
      {roster.map((entry) => (
        <CheckInRow key={entry.userId} cleanupId={cleanupId} entry={entry} />
      ))}
    </ul>
  );
}

function CheckInRow({ cleanupId, entry }: { cleanupId: string; entry: CheckInEntry }) {
  const [pending, startTransition] = useTransition();
  const [checkedIn, setCheckedIn] = useState(entry.checkedIn);
  const [items, setItems] = useState(String(entry.itemsVerified));
  const [savedItems, setSavedItems] = useState(entry.itemsVerified);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = nameFor(entry);
  const count = Number(items);
  const valid = items.trim() !== "" && Number.isInteger(count) && count >= 0 && count <= 5000;
  const unsaved = checkedIn && valid && count !== savedItems;

  const run = (work: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, onOk: () => void) => {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) return setError(result.error);
      onOk();
      setStatus(result.message);
    });
  };

  const toggle = () => {
    if (checkedIn) {
      return run(
        () => undoCheckIn(cleanupId, entry.userId),
        () => {
          setCheckedIn(false);
          setSavedItems(0);
          setItems("0");
        },
      );
    }
    const first = valid ? count : 0;
    run(
      () => checkInAttendee(cleanupId, entry.userId, first),
      () => {
        setCheckedIn(true);
        setSavedItems(first);
        setItems(String(first));
      },
    );
  };

  const save = () =>
    run(
      () => checkInAttendee(cleanupId, entry.userId, count),
      () => setSavedItems(count),
    );

  return (
    <li className="rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} src={entry.avatarUrl} size={40} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-shell">{name}</span>

        <label className="flex h-11 items-center gap-2 text-sm text-shell">
          <input
            type="checkbox"
            checked={checkedIn}
            disabled={pending}
            onChange={toggle}
            aria-label={`Checked in: ${name}`}
            className="h-5 w-5 accent-[color:var(--color-foam)]"
          />
          Checked in
        </label>

        <span className="flex items-center gap-2 text-sm text-mist">
          Items
          <input
            type="number"
            min={0}
            max={5000}
            step={1}
            inputMode="numeric"
            value={items}
            disabled={pending || !checkedIn}
            onChange={(e) => setItems(e.target.value)}
            aria-label={`Items collected by ${name}`}
            className="h-11 w-24 rounded-xl border border-line bg-navy px-3 text-sm text-shell disabled:opacity-60"
          />
        </span>

        <button
          type="button"
          onClick={save}
          disabled={pending || !unsaved}
          aria-label={`Save items for ${name}`}
          className="h-11 rounded-full bg-foam px-4 text-sm font-semibold text-foam-deep disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {!valid && checkedIn && <p className="mt-2 text-xs text-shell">Enter a whole number from 0 to 5000.</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-shell">
          {error}
        </p>
      )}
      <p role="status" className="mt-2 text-xs text-mist empty:mt-0">
        {pending ? "Saving" : (status ?? "")}
      </p>
    </li>
  );
}
