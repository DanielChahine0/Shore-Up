import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { signOut } from "@/app/actions/profile";
import { PostCard } from "@/components/cn/PostCard";
import { BadgeGroupList, Progress } from "@/components/profile/badges";
import { Avatar } from "@/components/ui/Avatar";
import { cleanupsToNextLevel, GAMIFICATION_UNLOCK_ITEMS, levelFor } from "@/lib/achievements/config";
import { buildBadgeGroups, earnedCount, type BadgeGroup } from "@/lib/profiles/badges";
import { MODE_LABELS } from "@/lib/profiles/modes";
import { getProfileByUsername, getProfileDetails, type ProfileEvent } from "@/lib/profiles/queries";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const monthFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long" });
const eventFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ProfilePage({ params }: PageProps<"/profile/[username]">) {
  const { username } = await params;
  if (!supabaseConfigured()) notFound();
  const found = await getProfileByUsername(username);
  if (!found) notFound();

  const { profile, isOwner, own } = found;
  const { stats, posts, trash, bestSessionItems, events, achievements, communities } = await getProfileDetails(profile.id, isOwner);
  const level = levelFor(stats.total_cleanups);
  const next = cleanupsToNextLevel(stats.total_cleanups);
  const groups = buildBadgeGroups(achievements, trash.total_items);
  const visibleToOthers = own ? own.is_adult_confirmed && !own.is_hidden : true;

  return (
    <article>
      {isOwner && !visibleToOthers && (
        <p className="mb-4 rounded-2xl border border-line bg-navy/60 px-4 py-3 text-sm text-shell">
          Only you can see this profile.{" "}
          {own?.is_hidden ? "It is hidden." : "Confirm you are 18 or older to make it public."}{" "}
          <Link href="/profile/edit" className="font-medium text-foam">
            Change visibility
          </Link>
        </p>
      )}

      <header className="flex items-start gap-4">
        <Avatar name={profile.display_name} src={profile.avatar_url} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-shell">{profile.display_name}</h1>
          <p className="text-sm text-mist">
            @{profile.username}
            {profile.area && `, ${profile.area}`}
          </p>
          <p className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-foam/50 px-3 py-0.5 text-xs font-medium text-foam">{MODE_LABELS[profile.mode]}</span>
            {trash.gamification_unlocked && <span className="inline-flex rounded-full bg-foam/15 px-3 py-0.5 text-xs font-medium text-foam">Level {level.name}</span>}
          </p>
        </div>
        {isOwner && (
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Link href="/profile/edit" className="inline-flex min-h-11 items-center rounded-full bg-foam px-4 text-sm font-semibold text-foam-deep">
              Edit profile
            </Link>
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-shell">
                Sign out
              </button>
            </form>
          </div>
        )}
      </header>

      {profile.bio && <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-shell">{profile.bio}</p>}
      <p className="mt-3 text-sm text-mist">Joined {monthFmt.format(new Date(profile.created_at))}</p>

      <section className="mt-8" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-lg font-semibold text-shell">
          Badges
        </h2>
        {trash.gamification_unlocked ? (
          <>
            <p className="mt-1 text-sm text-mist">
              Level {level.name}. {next ? `${next.remaining} more ${next.remaining === 1 ? "cleanup" : "cleanups"} to reach ${next.name}.` : "The highest level. Thank you for looking after the shore."}
            </p>
            {groups.map((group) => (
              <BadgeGroupList key={group.category} group={group} earned={earnedCount(group)} />
            ))}
          </>
        ) : (
          <LockedBadges groups={groups} isOwner={isOwner} bestSessionItems={bestSessionItems} displayName={profile.display_name} />
        )}
      </section>

      <section className="mt-10" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="text-lg font-semibold text-shell">
          Totals
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={trash.total_items} label="items logged" />
          <Stat
            value={trash.verified_items}
            label="items verified"
            note={`Verified by organizers across ${trash.events_attended} ${trash.events_attended === 1 ? "event" : "events"}`}
            highlight
          />
          <Stat value={stats.total_cleanups} label="cleanups posted" />
          <Stat value={stats.beaches_cleaned} label="beaches cleaned" />
          <Stat value={stats.bags_collected} label="bags collected" />
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-lg font-semibold text-shell">
          Events
        </h2>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-shell">Upcoming</h3>
        {events.upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-mist">
            {isOwner ? (
              <>
                No cleanups booked.{" "}
                <Link href="/" className="font-medium text-foam">
                  Find one on the map
                </Link>{" "}
                and join a crew.
              </>
            ) : (
              `${profile.display_name} has no cleanups coming up.`
            )}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {events.upcoming.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-shell">Previous</h3>
        {events.previous.length === 0 ? (
          <p className="mt-2 text-sm text-mist">{isOwner ? "Cleanups you attend will be listed here, along with what the organizer verified." : `${profile.display_name} has not been to a cleanup yet.`}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {events.previous.map((event) => (
              <EventRow key={event.id} event={event} past />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="text-lg font-semibold text-shell">
          Posts
        </h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-mist">
            {isOwner ? (
              <>
                Nothing posted yet. Clean a zone, then share it from{" "}
                <Link href="/" className="font-medium text-foam">
                  the beach on the map
                </Link>
                .
              </>
            ) : (
              `${profile.display_name} has not posted a cleanup yet.`
            )}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} compact />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="communities-heading">
        <h2 id="communities-heading" className="text-lg font-semibold text-shell">
          Communities
        </h2>
        {communities.length === 0 ? (
          <p className="mt-2 text-sm text-mist">
            {isOwner ? (
              <>
                No community yet.{" "}
                <Link href="/communities" className="font-medium text-foam">
                  Join one near you
                </Link>{" "}
                to see what neighbours are finding.
              </>
            ) : (
              `${profile.display_name} is not in a community yet.`
            )}
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {communities.map((c) => (
              <li key={c.slug}>
                <Link href={`/cn/${c.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-shell hover:border-foam/60">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

/**
 * Before the first five-item session the groups are shown as a dimmed preview
 * behind a panel that explains how to open them. The preview is decorative, so
 * the explanation carries everything a screen reader needs.
 */
function LockedBadges({ groups, isOwner, bestSessionItems, displayName }: { groups: BadgeGroup[]; isOwner: boolean; bestSessionItems: number; displayName: string }) {
  return (
    <>
      <div className="mt-3 rounded-3xl border border-foam/30 bg-navy/70 p-5">
        <h3 className="text-base font-semibold text-shell">Badges are locked</h3>
        {isOwner ? (
          <>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-shell">
              Badges and levels open up the first time you log {GAMIFICATION_UNLOCK_ITEMS} pieces of trash in a single clean session. Tap <strong className="font-semibold">Log trash</strong> on the map to start
              one.
            </p>
            <div className="mt-4 max-w-xs">
              <Progress label="unlocking badges" current={bestSessionItems} target={GAMIFICATION_UNLOCK_ITEMS} />
            </div>
            <p className="mt-1 text-xs text-mist">{bestSessionItems === 0 ? "No session logged yet." : "Your best session so far."}</p>
            <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-foam px-5 text-sm font-semibold text-foam-deep">
              Open the map
            </Link>
          </>
        ) : (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-shell">{displayName} has not unlocked badges yet.</p>
        )}
      </div>

      <div aria-hidden className="pointer-events-none relative mt-4 max-h-72 select-none overflow-hidden">
        <div className="opacity-40 blur-[2px]">
          {groups.map((group) => (
            <BadgeGroupList key={group.category} group={group} earned={earnedCount(group)} />
          ))}
        </div>
        {/* The fade sits outside the blur so the preview ends softly instead of being cut off. */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-abyss" />
      </div>
    </>
  );
}

function EventRow({ event, past = false }: { event: ProfileEvent; past?: boolean }) {
  return (
    <li>
      <Link href={`/cleanups/${event.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-navy/50 px-4 py-3 hover:border-foam/60">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-shell">{event.beachName}</span>
          <span className="block truncate text-xs text-mist">
            {event.beachArea}, {eventFmt.format(new Date(event.startsAt))}
          </span>
          {past && event.verifiedItems !== null && (
            <span className="mt-1.5 inline-flex rounded-full bg-foam/15 px-2.5 py-0.5 text-[11px] font-medium text-foam">Checked in - {event.verifiedItems} items verified</span>
          )}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-mist">
          {event.attendeeCount} {event.attendeeCount === 1 ? "person" : "people"}
        </span>
      </Link>
    </li>
  );
}

function Stat({ value, label, note, highlight = false }: { value: number; label: string; note?: string; highlight?: boolean }) {
  return (
    <li className={`rounded-2xl border p-4 ${highlight ? "border-foam/40 bg-foam/10" : "border-line bg-navy/60"}`}>
      <p className={`text-2xl font-semibold tabular-nums ${highlight ? "text-foam" : "text-shell"}`}>{value}</p>
      <p className="text-xs text-shell">{label}</p>
      {note && <p className="mt-1 text-[11px] leading-snug text-mist">{note}</p>}
    </li>
  );
}
