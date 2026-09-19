import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBeach, listBeaches } from "@/lib/beaches";

/** Only seeded beaches exist; any other id is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return listBeaches().map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/beach/[id]">): Promise<Metadata> {
  const { id } = await params;
  const beach = getBeach(id);
  return beach ? { title: beach.name, description: `How clean ${beach.name} is, zone by zone.` } : {};
}

/** Opens with the camera already on this beach. The map layout reads the id from the URL. */
export default async function BeachPage({ params }: PageProps<"/beach/[id]">) {
  const { id } = await params;
  if (!getBeach(id)) notFound();
  return null;
}
