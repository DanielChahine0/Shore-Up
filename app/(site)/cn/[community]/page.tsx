import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityFeed } from "@/components/cn/CommunityFeed";
import { listBeaches } from "@/lib/beaches";
import { getCommunity, listMemberships, listPosts } from "@/lib/communities/queries";
import { distanceKm } from "@/lib/geo/round";
import { getViewer } from "@/lib/profiles/queries";

export async function generateMetadata({ params }: PageProps<"/cn/[community]">): Promise<Metadata> {
  const { community: slug } = await params;
  const community = await getCommunity(slug);
  return { title: community ? `CN: ${community.name}` : "Community News" };
}

export default async function CommunityNewsPage({ params }: PageProps<"/cn/[community]">) {
  const { community: slug } = await params;
  const [community, viewer] = await Promise.all([getCommunity(slug), getViewer()]);
  if (!community) notFound();

  const [posts, memberships] = await Promise.all([listPosts({ communityId: community.id }, viewer?.id ?? null), viewer ? listMemberships(viewer.id) : []]);
  const beaches = listBeaches();
  const nearest = [...beaches].sort((a, b) => distanceKm(community, a) - distanceKm(community, b))[0];

  return (
    <>
      <p className="text-sm text-mist">Community News</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-shell">{community.name}</h1>
      <p className="text-sm text-mist">
        {community.area}, {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
      </p>

      {community.nonprofit && (
        <div className="mt-4 rounded-2xl border border-line bg-navy/60 p-4">
          <p className="text-xs text-mist">Hosted by</p>
          <p className="text-sm font-semibold text-shell">{community.nonprofit.name}</p>
          {community.nonprofit.description && <p className="mt-1 text-sm leading-relaxed text-mist">{community.nonprofit.description}</p>}
        </div>
      )}

      <CommunityFeed
        community={community}
        posts={posts}
        isMember={memberships.some((m) => m.id === community.id)}
        signedIn={viewer !== null}
        beaches={beaches.map((b) => ({ id: b.id, name: b.name, area: b.area }))}
        nearestBeachId={nearest?.id}
      />
    </>
  );
}
