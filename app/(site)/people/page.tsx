import type { Metadata } from "next";
import Link from "next/link";
import { Directory } from "@/components/people/Directory";
import { listDirectory } from "@/lib/profiles/directory";
import { getViewer } from "@/lib/profiles/queries";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  if (!supabaseConfigured()) {
    return <p className="mt-10 text-center text-sm text-ink-soft">The directory opens once Supabase is configured. See the README.</p>;
  }
  const [people, viewer] = await Promise.all([listDirectory(), getViewer()]);

  let joined: string[] = [];
  if (viewer) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("cleanup_attendees").select("cleanup_id").eq("user_id", viewer.id);
    joined = (data ?? []).map((r) => r.cleanup_id as string);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">People</h1>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">
        Volunteers who chose to be listed. You see a city or neighbourhood and the beach of a planned cleanup, never anyone&apos;s exact location.
      </p>
      {viewer && !viewer.directory_opt_in && (
        <p className="mt-3 text-sm text-ink-soft">
          You aren&apos;t listed.{" "}
          <Link href="/profile/edit" className="font-medium text-brand-strong">
            Add yourself from your profile
          </Link>
        </p>
      )}
      <Directory people={people} viewerId={viewer?.id ?? null} joinedCleanupIds={joined} />
    </>
  );
}
