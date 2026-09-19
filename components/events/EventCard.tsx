"use client";

import { JoinButton } from "@/components/people/JoinButton";
import { Avatar } from "@/components/ui/Avatar";
import type { RankedEvent } from "@/lib/cleanups/rank";

/** Built once, in the visitor's own locale and time zone. */
let whenFormat: Intl.DateTimeFormat | null = null;
function formatWhen(startsAt: string): string {
  whenFormat ??= new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return whenFormat.format(new Date(startsAt));
}

let kmFormat: Intl.NumberFormat | null = null;
function formatKm(distance: number): string {
  kmFormat ??= new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  return kmFormat.format(distance);
}

type Props = {
  event: RankedEvent;
  signedIn: boolean;
  onPickBeach: (beachId: string) => void;
  onRegisteredChange: (id: string, registered: boolean) => void;
  onToast: (message: string) => void;
};

export function EventCard({ event, signedIn, onPickBeach, onRegisteredChange, onToast }: Props) {
  const hidden = event.attendeeCount - event.attendees.length;

  return (
    <li className="rounded-2xl border border-line bg-navy/60 p-4">
      <h3 className="text-[15px] font-semibold leading-snug">
        <button type="button" onClick={() => onPickBeach(event.beachId)} className="text-left text-shell hover:text-foam">
          {event.beachName}
        </button>
      </h3>
      <p className="mt-0.5 text-xs text-mist">
        {event.beachArea}
        {event.distanceKm !== null && ` · ${formatKm(event.distanceKm)} km away`}
      </p>

      <p className="mt-2 text-sm text-shell">{formatWhen(event.startsAt)}</p>
      <p className="text-xs text-mist">{event.organizerName ? `Hosted by ${event.organizerName}` : "Hosted by a volunteer with a private profile"}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex items-center gap-2">
          {event.attendees.length > 0 && (
            <span className="flex -space-x-1" aria-hidden>
              {event.attendees.map((person) => (
                <span key={person.userId} className="rounded-full ring-2 ring-navy">
                  <Avatar name={person.displayName} src={person.avatarUrl} size={28} />
                </span>
              ))}
              {hidden > 0 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tide text-[11px] font-semibold text-shell ring-2 ring-navy">+{hidden}</span>
              )}
            </span>
          )}
          <span className="text-xs text-mist">
            {event.attendeeCount} {event.attendeeCount === 1 ? "person" : "people"} going
          </span>
        </p>
        <JoinButton
          cleanupId={event.id}
          returnTo="/"
          joined={event.registered}
          signedIn={signedIn}
          onChange={(registered) => onRegisteredChange(event.id, registered)}
          onDone={onToast}
        />
      </div>
    </li>
  );
}
