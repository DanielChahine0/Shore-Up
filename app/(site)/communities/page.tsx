import type { Metadata } from "next";
import { CommunityList } from "@/components/cn/CommunityList";
import { listCommunities, listCommunityPreviews, listMemberships } from "@/lib/communities/queries";
import { getViewer } from "@/lib/profiles/queries";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  if (!supabaseConfigured()) {
    return <p className="mt-10 text-center text-sm text-ink-soft">Communities open once Supabase is configured. See the README.</p>;
  }
  const [communities, previews, viewer] = await Promise.all([listCommunities(), listCommunityPreviews(), getViewer()]);
  const memberships = viewer ? await listMemberships(viewer.id) : [];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Communities</h1>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-soft">
        Local crews who look after a stretch of shore. Join one to post your cleanups to its Community News and see what your neighbours are clearing.
      </p>
      <CommunityList communities={communities} previews={previews} joinedIds={memberships.map((m) => m.id)} />
    </>
  );
}
