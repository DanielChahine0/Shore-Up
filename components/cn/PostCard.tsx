"use client";
/* eslint-disable @next/next/no-img-element -- post photos are already resized and stored as WebP */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { reportPost, toggleLike } from "@/app/actions/communities";
import { Avatar } from "@/components/ui/Avatar";
import { HeartIcon } from "@/components/ui/icons";
import type { FeedPost } from "@/lib/communities/queries";

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" });

export function PostCard({ post, compact = false }: { post: FeedPost; compact?: boolean }) {
  const pathname = usePathname();
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likes, setLikes] = useState(post.likeCount);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onLike = () => {
    const next = !liked;
    // Optimistic: the heart responds at once and rolls back if the server refuses.
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleLike(post.id, next, pathname);
      if (!result.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
        setNotice(result.error);
      }
    });
  };

  const onReport = (form: FormData) =>
    startTransition(async () => {
      const result = await reportPost(post.id, String(form.get("reason") ?? ""), pathname);
      setReporting(false);
      setNotice(result.ok ? "Reported. Thanks, a moderator will take a look." : result.error);
    });

  const name = post.author?.displayName ?? "A volunteer";
  return (
    <article className={`rounded-3xl border border-line bg-surface ${compact ? "p-3.5" : "p-5"}`}>
      <header className="flex items-center gap-3">
        {post.author ? (
          <Link href={`/profile/${post.author.username}`} className="shrink-0">
            <Avatar name={name} src={post.author.avatarUrl} size={compact ? 32 : 40} />
          </Link>
        ) : (
          <Avatar name={name} size={compact ? 32 : 40} />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {post.author ? (
              <Link href={`/profile/${post.author.username}`} className="hover:text-brand-strong">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          <p className="truncate text-xs text-ink-soft">
            <Link href={`/beach/${post.beachId}`} className="hover:text-brand-strong">
              {post.beachName}
            </Link>
            , {post.zoneName}, {dateFmt.format(new Date(post.createdAt))}
          </p>
        </div>
      </header>

      <p className={`mt-3 whitespace-pre-line text-ink ${compact ? "line-clamp-3 text-sm" : "text-[15px] leading-relaxed"}`}>{post.body}</p>

      {post.photoUrls.length > 0 && (
        <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-2xl ${post.photoUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Cleanup photo ${i + 1} of ${post.photoUrls.length} at ${post.beachName}`}
              loading="lazy"
              className={`w-full bg-tint object-cover ${post.photoUrls.length === 1 ? "aspect-[16/10]" : post.photoUrls.length === 3 && i === 0 ? "col-span-2 aspect-[16/8]" : "aspect-square"}`}
            />
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-4 text-sm">
        <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-ink">
          {post.bags} {post.bags === 1 ? "bag" : "bags"}
        </span>
        <button type="button" onClick={onLike} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={`flex items-center gap-1.5 ${liked ? "text-brand-strong" : "text-ink-soft hover:text-ink"}`}>
          <HeartIcon className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          <span className="tabular-nums">{likes}</span>
        </button>
        <button type="button" onClick={() => setReporting((v) => !v)} aria-expanded={reporting} className="ml-auto text-xs text-ink-soft hover:text-ink">
          Report
        </button>
      </footer>

      {reporting && (
        <form action={onReport} className="mt-3 flex gap-2">
          <input name="reason" maxLength={500} placeholder="What's wrong with this post? (optional)" aria-label="Reason for reporting" className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-soft" />
          <button type="submit" className="h-11 shrink-0 rounded-full border border-line-strong px-4 text-sm text-ink">
            Send report
          </button>
        </form>
      )}
      {notice && (
        <p role="status" className="mt-2 text-xs text-ink-soft">
          {notice}
        </p>
      )}
    </article>
  );
}
