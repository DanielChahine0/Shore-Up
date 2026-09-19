import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { signOut } from "@/app/actions/profile";
import { Avatar } from "@/components/ui/Avatar";
import { ACHIEVEMENTS, cleanupsToNextLevel, levelFor, type FixedAchievementKey } from "@/lib/achievements/config";
import { MODE_LABELS } from "@/lib/profiles/modes";
import { getProfileByUsername, getProfileDetails } from "@/lib/profiles/queries";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const dateFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long" });

export default async function ProfilePage({ params }: PageProps<"/profile/[username]">) {
  const { username } = await params;
  if (!supabaseConfigured()) notFound();
  const found = await getProfileByUsername(username);
  if (!found) notFound();

  const { profile, isOwner, own } = found;
  const { stats, history, achievements, communities } = await getProfileDetails(profile.id);
  const level = levelFor(stats.total_cleanups);
  const next = cleanupsToNextLevel(stats.total_cleanups);
  const earned = new Set(achievements.map((a) => a.achievement_key));
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
          <p className="mt-2 inline-flex rounded-full border border-foam/50 px-3 py-0.5 text-xs font-medium text-foam">{MODE_LABELS[profile.mode]}</p>
        </div>
        {isOwner && (
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Link href="/profile/edit" className="rounded-full bg-foam px-4 py-2 text-sm font-semibold text-foam-deep">
              Edit profile
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm text-shell">
                Sign out
              </button>
            </form>
          </div>
        )}
      </header>

      {profile.bio && <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-shell">{profile.bio}</p>}
      <p className="mt-3 text-sm text-mist">Joined {monthFmt.format(new Date(profile.created_at))}</p>

      <section aria-label="Stats" className="mt-6 grid grid-cols-3 gap-3">
        <Stat value={stats.total_cleanups} label="cleanups" />
        <Stat value={stats.beaches_cleaned} label="beaches" />
        <Stat value={stats.bags_collected} label="bags collected" />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-navy/60 p-4">
        <p className="text-sm text-mist">Level</p>
        <p className="text-lg font-semibold text-shell">{level.name}</p>
        <p className="mt-0.5 text-sm text-mist">
          {next ? `${next.remaining} more ${next.remaining === 1 ? "cleanup" : "cleanups"} to reach ${next.name}.` : "The highest level. Thank you for looking after the shore."}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-shell">Achievements</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(ACHIEVEMENTS) as FixedAchievementKey[]).map((key) => {
            const has = earned.has(key);
            return (
              <li key={key} className={`rounded-2xl border p-3 ${has ? "border-foam/50 bg-foam/10" : "border-line opacity-60"}`}>
                <p className={`text-sm font-semibold ${has ? "text-foam" : "text-shell"}`}>{ACHIEVEMENTS[key].name}</p>
                <p className="mt-0.5 text-xs text-mist">{ACHIEVEMENTS[key].description}</p>
                <p className="mt-1.5 text-[11px] text-mist">{has ? "Earned" : "Not yet earned"}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-shell">Communities</h2>
        {communities.length === 0 ? (
          <p className="mt-2 text-sm text-mist">{isOwner ? "You haven't joined a community yet." : "Not in a community yet."}</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {communities.map((c) => (
              <li key={c.slug}>
                <Link href={`/cn/${c.slug}`} className="inline-flex rounded-full border border-line px-3 py-1.5 text-sm text-shell hover:border-foam/60">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-shell">Cleanup history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-mist">{isOwner ? "Your cleanups will show up here once you post one." : "No cleanups posted yet."}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/beach/${h.beachId}`} className="text-sm font-medium text-shell hover:text-foam">
                    {h.beachName}
                  </Link>
                  <p className="text-xs text-mist">
                    {h.zoneName}, {dateFmt.format(new Date(h.createdAt))}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-mist">
                  {h.bags} {h.bags === 1 ? "bag" : "bags"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-navy/60 p-4">
      <p className="text-2xl font-semibold tabular-nums text-shell">{value}</p>
      <p className="text-xs text-mist">{label}</p>
    </div>
  );
}
