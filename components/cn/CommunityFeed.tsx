"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { joinCommunity, leaveCommunity } from "@/app/actions/communities";
import { refreshViewer } from "@/components/chrome/useViewer";
import { NewPostModal, type PostTarget } from "@/components/modals/NewPostModal";
import { Toast } from "@/components/ui/Toast";
import { achievementName } from "@/lib/achievements/config";
import type { Community, FeedPost } from "@/lib/communities/queries";
import { PostCard } from "./PostCard";

type Props = {
  community: Community;
  posts: FeedPost[];
  isMember: boolean;
  signedIn: boolean;
  beaches: { id: string; name: string; area: string }[];
  /** The seeded beach nearest this community, preselected in the post form. */
  nearestBeachId?: string;
};

export function CommunityFeed({ community, posts, isMember, signedIn, beaches, nearestBeachId }: Props) {
  const router = useRouter();
  const [member, setMember] = useState(isMember);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);

  const target: PostTarget = { id: community.id, slug: community.slug, name: community.name };

  const onMembership = () => {
    if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(`/cn/${community.slug}`)}`);
    setError(null);
    startTransition(async () => {
      const result = member ? await leaveCommunity(community.id, community.slug) : await joinCommunity(community.id, community.slug);
      if (!result.ok) return setError(result.error);
      setMember(!member);
      refreshViewer();
      router.refresh();
    });
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {member && (
          <button type="button" onClick={() => setPosting(true)} className="h-11 rounded-full bg-foam px-6 text-sm font-semibold text-foam-deep">
            Post a cleanup
          </button>
        )}
        <button
          type="button"
          onClick={onMembership}
          disabled={pending}
          className={`h-11 rounded-full px-6 text-sm font-semibold disabled:opacity-60 ${member ? "border border-line text-shell" : "bg-foam text-foam-deep"}`}
        >
          {pending ? "One moment" : member ? "Leave community" : "Join community"}
        </button>
        {!member && <p className="text-sm text-mist">Join to post your cleanups here.</p>}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-line bg-navy px-3 py-2 text-sm text-shell">
          {error}
        </p>
      )}

      <section aria-label="Community News" className="mt-8 space-y-4">
        {posts.length === 0 ? (
          <p className="rounded-3xl border border-line p-6 text-center text-sm text-mist">No posts yet. The first cleanup posted here leads the feed.</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>

      {posting && (
        <NewPostModal
          communities={[target]}
          beaches={beaches}
          initialBeachId={nearestBeachId}
          onClose={() => setPosting(false)}
          onPosted={({ newAchievements }) => {
            setPosting(false);
            setToast(newAchievements.length > 0 ? `Badge earned: ${newAchievements.map(achievementName).join(", ")}` : "Posted. Litter in that zone is now low.");
            router.refresh();
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  );
}
