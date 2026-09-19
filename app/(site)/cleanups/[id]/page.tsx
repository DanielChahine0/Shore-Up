import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinButton } from "@/components/people/JoinButton";
import { Avatar } from "@/components/ui/Avatar";
import { getCleanup } from "@/lib/cleanups/queries";
import { MODE_LABELS } from "@/lib/profiles/modes";
import { getViewer } from "@/lib/profiles/queries";

export const metadata: Metadata = { title: "Cleanup" };

const whenFmt = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

export default async function CleanupPage({ params }: PageProps<"/cleanups/[id]">) {
  const { id } = await params;
  const [cleanup, viewer] = await Promise.all([getCleanup(id), getViewer()]);
  if (!cleanup) notFound();

  const isOrganizer = viewer?.id === cleanup.organizerId;
  const hasJoined = Boolean(viewer && cleanup.attendees.some((a) => a.userId === viewer.id));
  const unlisted = cleanup.attendeeCount - cleanup.attendees.length;

  return (
    <article>
      <p className="text-sm text-mist">{cleanup.isUpcoming ? "Upcoming cleanup" : "Past cleanup"}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-shell">
        <Link href={`/beach/${cleanup.beachId}`} className="hover:text-foam">
          {cleanup.beachName}
        </Link>
        {cleanup.zoneName && <span className="text-mist">, {cleanup.zoneName}</span>}
      </h1>
      <p className="text-sm text-mist">{cleanup.beachArea}</p>
      <p className="mt-4 text-[15px] text-shell">{whenFmt.format(new Date(cleanup.startsAt))}</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-navy/60 p-4">
        {cleanup.organizer ? (
          <Link href={`/profile/${cleanup.organizer.username}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={cleanup.organizer.displayName} src={cleanup.organizer.avatarUrl} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-shell">Organized by {cleanup.organizer.displayName}</span>
              <span className="block text-xs text-mist">{MODE_LABELS[cleanup.organizer.mode]}</span>
            </span>
          </Link>
        ) : (
          <p className="text-sm text-mist">Organized by a volunteer with a private profile.</p>
        )}
        {cleanup.isUpcoming && !isOrganizer && <JoinButton cleanupId={cleanup.id} returnTo={`/cleanups/${cleanup.id}`} joined={hasJoined} size="lg" />}
        {isOrganizer && <p className="text-sm text-mist">You&apos;re hosting this one.</p>}
      </div>

      {cleanup.notes && <p className="mt-5 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-shell">{cleanup.notes}</p>}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-shell">
          {cleanup.attendeeCount} {cleanup.attendeeCount === 1 ? "person" : "people"} going
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {cleanup.attendees.map((a) => (
            <li key={a.userId}>
              <Link href={`/profile/${a.username}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-foam/60">
                <Avatar name={a.displayName} src={a.avatarUrl} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-shell">{a.displayName}</span>
                  <span className="block truncate text-xs text-mist">{a.area || "Area not shared"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {unlisted > 0 && (
          <p className="mt-3 text-sm text-mist">
            Plus {unlisted} {unlisted === 1 ? "person" : "people"} with a private profile.
          </p>
        )}
      </section>
    </article>
  );
}
