import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CleanupCover } from "@/components/events/CleanupCover";
import { JoinButton } from "@/components/people/JoinButton";
import { Avatar } from "@/components/ui/Avatar";
import { getCheckInBoard, getCleanup } from "@/lib/cleanups/queries";
import { MODE_LABELS } from "@/lib/profiles/modes";
import { getViewer } from "@/lib/profiles/queries";
import { CheckInList } from "./CheckInList";

export const metadata: Metadata = { title: "Cleanup" };

const whenFmt = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

/** Faces beside the register button, so you can see who is already going. */
const AVATAR_ROW = 5;

export default async function CleanupPage({ params }: PageProps<"/cleanups/[id]">) {
  const { id } = await params;
  const [cleanup, viewer] = await Promise.all([getCleanup(id), getViewer()]);
  if (!cleanup) notFound();

  const board = await getCheckInBoard(cleanup.id);
  const isOrganizer = viewer?.id === cleanup.organizerId;
  // The roster covers private profiles too, so the button is right for everyone.
  const hasJoined = Boolean(viewer && board.roster.some((entry) => entry.userId === viewer.id));
  const unlisted = cleanup.attendeeCount - cleanup.attendees.length;
  const faces = cleanup.attendees.slice(0, AVATAR_ROW);
  const moreFaces = cleanup.attendeeCount - faces.length;
  const started = new Date(cleanup.startsAt) <= new Date();

  return (
    <article>
      <CleanupCover cleanupId={cleanup.id} sizes="(min-width: 768px) 736px, 100vw" className="mb-5 rounded-2xl" preload />
      <p className="text-sm text-ink-soft">{cleanup.isUpcoming ? "Upcoming cleanup" : "Past cleanup"}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        <Link href={`/beach/${cleanup.beachId}`} className="hover:text-brand-strong">
          {cleanup.beachName}
        </Link>
        {cleanup.zoneName && <span className="text-ink-soft">, {cleanup.zoneName}</span>}
      </h1>
      <p className="text-sm text-ink-soft">{cleanup.beachArea}</p>
      <p className="mt-4 text-[15px] text-ink">{whenFmt.format(new Date(cleanup.startsAt))}</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
        {cleanup.organizer ? (
          <Link href={`/profile/${cleanup.organizer.username}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={cleanup.organizer.displayName} src={cleanup.organizer.avatarUrl} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">Organized by {cleanup.organizer.displayName}</span>
              <span className="block text-xs text-ink-soft">{MODE_LABELS[cleanup.organizer.mode]}</span>
            </span>
          </Link>
        ) : (
          <p className="text-sm text-ink-soft">Organized by a volunteer with a private profile.</p>
        )}
        <div className="flex items-center gap-3">
          {faces.length > 0 && (
            <span className="flex -space-x-1" aria-hidden>
              {faces.map((a) => (
                <span key={a.userId} className="rounded-full ring-2 ring-surface">
                  <Avatar name={a.displayName} src={a.avatarUrl} size={32} />
                </span>
              ))}
              {moreFaces > 0 && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-tint text-xs font-semibold text-ink ring-2 ring-surface">+{moreFaces}</span>}
            </span>
          )}
          {cleanup.isUpcoming && !isOrganizer && (
            <JoinButton cleanupId={cleanup.id} returnTo={`/cleanups/${cleanup.id}`} joined={hasJoined} signedIn={Boolean(viewer)} size="lg" />
          )}
          {isOrganizer && <p className="text-sm text-ink-soft">You&apos;re hosting this one.</p>}
        </div>
      </div>

      {cleanup.notes && <p className="mt-5 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink">{cleanup.notes}</p>}

      {board.checkedIn > 0 && (
        <p className="mt-5 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
          {board.checkedIn} of {board.roster.length} checked in, {board.itemsVerified} items verified.
          <span className="mt-1 block text-xs text-ink-soft">Verified by the organizer at the end of the event.</span>
        </p>
      )}

      {isOrganizer && started && (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-ink">Take the tally</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-soft">
            Tick off everyone who came and record what they collected. This is your endorsement, and it shows on their profiles.
          </p>
          {board.roster.length > 0 ? (
            <CheckInList cleanupId={cleanup.id} roster={board.roster} />
          ) : (
            <p className="mt-4 text-sm text-ink-soft">Nobody registered for this one.</p>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-ink">
          {cleanup.attendeeCount} {cleanup.attendeeCount === 1 ? "person" : "people"} going
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {cleanup.attendees.map((a) => (
            <li key={a.userId}>
              <Link href={`/profile/${a.username}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-brand-strong/60">
                <Avatar name={a.displayName} src={a.avatarUrl} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{a.displayName}</span>
                  <span className="block truncate text-xs text-ink-soft">{a.area || "Area not shared"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {unlisted > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            Plus {unlisted} {unlisted === 1 ? "person" : "people"} with a private profile.
          </p>
        )}
      </section>
    </article>
  );
}
