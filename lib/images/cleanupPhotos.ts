/**
 * Stock photos of real beach cleanups, from Wikimedia Commons, stored in public/photos/cleanups.
 * Events have no photo of their own yet, so each one borrows a photo from this list.
 * Every entry carries alt text, and the credit is shown wherever a license asks for attribution.
 */
export type CleanupPhoto = {
  src: string;
  alt: string;
  credit: string;
  license: "Public domain" | "CC BY 2.0";
  source: string;
};

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const CLEANUP_PHOTOS: CleanupPhoto[] = [
  {
    src: "/photos/cleanups/cleanup-01.webp",
    alt: "Three volunteers in safety vests walk a wide sandy beach collecting debris under a clear blue sky.",
    credit: "Cape Hatteras National Seashore, NPS",
    license: "Public domain",
    source: commons("Volunteers_participate_in_beach_debris_cleanup_-_52752007055.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-02.webp",
    alt: "Three volunteers fill a black bag with debris on a dune-backed beach beside the surf.",
    credit: "Cape Hatteras National Seashore, NPS",
    license: "Public domain",
    source: commons("Volunteers_participate_in_beach_debris_cleanup_-_52751597181.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-03.webp",
    alt: "Two volunteers in yellow vests hold a rubbish bag on the sand in front of beach houses.",
    credit: "Cape Hatteras National Seashore, NPS",
    license: "Public domain",
    source: commons("Volunteers_participate_in_beach_debris_cleanup_-_52751597226.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-04.webp",
    alt: "A volunteer kneels on the sand, putting pieces of debris into a blue bucket.",
    credit: "Cape Hatteras National Seashore, NPS",
    license: "Public domain",
    source: commons("Volunteers_participate_in_beach_debris_cleanup.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-05.webp",
    alt: "Two volunteers carry bags of debris across a dark sand beach with sea stacks offshore.",
    credit: "NOAA National Marine Sanctuaries",
    license: "Public domain",
    source: commons("Second_Beach_for_International_Coastal_Cleanup_(37209289731).jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-06.webp",
    alt: "Six volunteers stand in a row on a beach holding litter pickers and a full black bag.",
    credit: "Cape Hatteras National Seashore, NPS",
    license: "Public domain",
    source: commons("Ocracoke_Beach_Access_volunteer_cleanup_09-18-2021_(51759287778).jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-07.webp",
    alt: "A group of volunteers raise their litter pickers behind a pile of driftwood planks and full black bags.",
    credit: "Debbie Foote",
    license: "Public domain",
    source: commons("Beach_Cleaning_Volunteers.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-08.webp",
    alt: "A large group of volunteers collect litter into black bags on a palm-lined white sand beach.",
    credit: "Environmental Management Bureau, DENR Region 6",
    license: "Public domain",
    source: commons("Boracay_Cleanup_EMB_DENR_R6.jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-09.webp",
    alt: "A volunteer in a sun hat ties a full black bag among driftwood on a wooded shoreline.",
    credit: "Virginia State Parks",
    license: "CC BY 2.0",
    source: commons("WE-_Beach_Cleanup_(7977263560).jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-10.webp",
    alt: "A volunteer in a sun hat holds a litter picker and a bag on a driftwood-strewn beach.",
    credit: "Virginia State Parks",
    license: "CC BY 2.0",
    source: commons("WE-_Beach_Cleanup_(7977262436).jpg"),
  },
  {
    src: "/photos/cleanups/cleanup-11.webp",
    alt: "Volunteers with orange buckets gather on a sandy spit beside calm blue water.",
    credit: "Mike Baird",
    license: "CC BY 2.0",
    source: commons("Morro_Bay,_CA_Sandspit_Coastal_Cleanup_Day_(CCD),_Saturday,_September_17,_2011_10.jpg"),
  },
];

/** Public domain photos only. Seeded feed posts show no credit line, so they never use a photo that requires one. */
export const UNCREDITED_PHOTOS = CLEANUP_PHOTOS.filter((p) => p.license === "Public domain");

/** The same event always gets the same photo, with no stored state. */
export function cleanupPhotoFor(cleanupId: string): CleanupPhoto {
  let hash = 0;
  for (let i = 0; i < cleanupId.length; i++) hash = (hash * 31 + cleanupId.charCodeAt(i)) >>> 0;
  return CLEANUP_PHOTOS[hash % CLEANUP_PHOTOS.length];
}
