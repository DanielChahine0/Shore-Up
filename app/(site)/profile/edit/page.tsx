import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { getViewer } from "@/lib/profiles/queries";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin?next=/profile/edit");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-shell">Edit profile</h1>
      <ProfileForm profile={viewer} />
    </>
  );
}
