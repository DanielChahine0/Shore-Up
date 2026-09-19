import Image from "next/image";
import { cleanupPhotoFor } from "@/lib/images/cleanupPhotos";

type Props = {
  cleanupId: string;
  /** CSS sizes hint, so the browser fetches a photo no larger than the slot. */
  sizes: string;
  className?: string;
  /** Load ahead of the rest of the page when the photo is the first thing seen. */
  preload?: boolean;
};

/** Cover photo for an event: a stock cleanup photo with its credit shown on the image. */
export function CleanupCover({ cleanupId, sizes, className = "", preload = false }: Props) {
  const photo = cleanupPhotoFor(cleanupId);
  return (
    <figure className={`relative aspect-[16/9] overflow-hidden bg-tint ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} preload={preload} className="object-cover" />
      {/* Solid ink behind white text: 14:1, whatever the photo underneath looks like. */}
      <figcaption className="absolute bottom-0 right-0 rounded-tl-lg bg-ink px-2 py-0.5 text-[11px] text-white">
        Photo:{" "}
        <a href={photo.source} target="_blank" rel="noreferrer" className="underline">
          {photo.credit}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        {photo.license !== "Public domain" && `, ${photo.license}`}
      </figcaption>
    </figure>
  );
}
