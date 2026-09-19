"use client";
/* eslint-disable @next/next/no-img-element -- previews of photos the user just uploaded */

import { useEffect, useRef, useState, useTransition } from "react";
import { createPost } from "@/app/actions/communities";
import { CloseIcon } from "@/components/ui/icons";
import type { AchievementKey } from "@/lib/achievements/config";
import type { BeachDetail } from "@/lib/beachDetail";

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const field = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink";

export type PostTarget = { id: string; slug: string; name: string };
type BeachOption = { id: string; name: string; area: string };
type ZoneOption = { zoneId: string; name: string; score: number; label: string };
type Photo = { path: string; url: string };

type Props = {
  communities: PostTarget[];
  beaches: BeachOption[];
  initialBeachId?: string;
  initialZoneId?: string;
  onClose: () => void;
  onPosted: (result: { newAchievements: AchievementKey[]; beachId: string; communitySlug: string }) => void;
};

export function NewPostModal({ communities, beaches, initialBeachId, initialZoneId, onClose, onPosted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? "");
  const [beachId, setBeachId] = useState(initialBeachId ?? "");
  const [zoneId, setZoneId] = useState(initialZoneId ?? "");
  const [zones, setZones] = useState<{ beachId: string; options: ZoneOption[] }>({ beachId: "", options: [] });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // See CreateCleanupModal: no close() on cleanup, or the dev double-mount dismisses the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Zones (with their current scores) for the chosen beach.
  useEffect(() => {
    if (!beachId) return;
    const controller = new AbortController();
    fetch(`/api/beaches/${beachId}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<BeachDetail>) : Promise.reject(new Error("zones"))))
      .then((detail) => setZones({ beachId, options: detail.score.zones }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError("The zones for that beach didn't load. Pick the beach again.");
      });
    return () => controller.abort();
  }, [beachId]);

  const zoneOptions = zones.beachId === beachId ? zones.options : [];

  const onPickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    setError(null);
    for (const file of picked) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 5 MB. Photos can be up to 5 MB each.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", "post");
        const res = await fetch("/api/uploads", { method: "POST", body });
        const json = (await res.json()) as { path?: string; url?: string; error?: string };
        if (!res.ok || !json.path || !json.url) setError(json.error ?? "A photo didn't upload. Try again.");
        else setPhotos((list) => [...list, { path: json.path!, url: json.url! }].slice(0, MAX_PHOTOS));
      } catch {
        setError("A photo didn't upload. Check your connection and try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const community = communities.find((c) => c.id === communityId);
    if (!community) return setError("Pick a community to post to.");
    if (!beachId || !zoneId) return setError("Pick the beach and the zone you cleaned.");
    if (photos.length === 0) return setError("Add at least one photo of the cleanup.");
    setError(null);
    startTransition(async () => {
      const result = await createPost({
        communityId: community.id,
        communitySlug: community.slug,
        beachId,
        zoneId,
        body: String(form.get("body") ?? ""),
        bags: Number(form.get("bags") ?? 0),
        photoPaths: photos.map((p) => p.path),
      });
      if (!result.ok) return setError(result.error);
      onPosted({ newAchievements: result.newAchievements, beachId, communitySlug: community.slug });
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="new-post-title"
      className="glass glass-panel m-auto max-h-[92dvh] w-[min(94vw,480px)] overflow-y-auto rounded-3xl p-0 text-ink backdrop:bg-wash/70"
    >
      <form onSubmit={onSubmit} className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-post-title" className="text-lg font-semibold tracking-tight">
              Post a cleanup
            </h2>
            <p className="text-sm text-ink-soft">Posting sets the zone&apos;s litter to low and turns it greener on the map.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-full p-1.5 text-ink-soft hover:text-ink">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {communities.length > 1 && (
          <label className="mt-5 block text-sm">
            Community
            <select value={communityId} onChange={(e) => setCommunityId(e.target.value)} className={`${field} h-11`}>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Beach
            <select
              value={beachId}
              onChange={(e) => {
                setBeachId(e.target.value);
                setZoneId("");
              }}
              required
              className={`${field} h-11`}
            >
              <option value="" disabled>
                Pick a beach
              </option>
              {beaches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}, {b.area}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Zone
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} required disabled={zoneOptions.length === 0} className={`${field} h-11 disabled:opacity-60`}>
              <option value="" disabled>
                {beachId && zoneOptions.length === 0 ? "Loading zones" : "Pick a zone"}
              </option>
              {zoneOptions.map((z) => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name} ({z.score}, {z.label})
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm">Photos (1 to 4)</legend>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {photos.map((photo, i) => (
              <div key={photo.path} className="relative aspect-square overflow-hidden rounded-xl bg-tint">
                <img src={photo.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((p) => p.path !== photo.path))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-wash/80 p-1 text-ink"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`u${i}`} className="aspect-square animate-pulse rounded-xl bg-tint/70" aria-label="Uploading photo" />
            ))}
            {photos.length + uploading < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-soft hover:border-brand-strong/60 hover:text-ink">
                Add
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onPickPhotos} className="sr-only" aria-label="Cleanup photos" />
          <p className="mt-1.5 text-xs text-ink-soft">JPG, PNG, or WebP up to 5 MB each. Location data is removed from every photo.</p>
        </fieldset>

        <label className="mt-4 block text-sm">
          What did you find?
          <textarea name="body" required maxLength={2000} rows={3} placeholder="Mostly bottle caps and fishing line near the rocks." className={`${field} py-2.5 placeholder:text-ink-soft`} />
        </label>

        <label className="mt-3 block text-sm">
          Bags collected
          <input name="bags" type="number" inputMode="numeric" min={0} max={500} step={1} defaultValue={1} required className={`${field} h-11 w-28`} />
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending || uploading > 0} className="mt-5 h-11 w-full rounded-full bg-brand-strong text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Posting" : uploading > 0 ? "Uploading photos" : "Post cleanup"}
        </button>
      </form>
    </dialog>
  );
}
