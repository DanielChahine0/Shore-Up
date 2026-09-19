"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MODES, type UserMode } from "@/lib/profiles/modes";
import { supabaseServer } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; fieldErrors?: Partial<Record<"username" | "display_name" | "bio" | "area", string>> };

export async function updateProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin?next=/profile/edit");

  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const area = String(form.get("area") ?? "").trim();
  const mode = String(form.get("mode") ?? "") as UserMode;
  const isAdult = form.get("is_adult_confirmed") === "on";

  const fieldErrors: ProfileFormState["fieldErrors"] = {};
  if (!/^[a-z0-9_]{3,30}$/.test(username)) fieldErrors.username = "Use 3 to 30 lowercase letters, numbers, or underscores.";
  if (displayName.length < 1 || displayName.length > 60) fieldErrors.display_name = "Enter a name up to 60 characters.";
  if (bio.length > 500) fieldErrors.bio = "Keep your bio under 500 characters.";
  if (area.length > 80) fieldErrors.area = "Keep your area under 80 characters.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  if (!MODES.includes(mode)) return { error: "Pick a current mode." };

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      bio,
      area,
      mode,
      is_adult_confirmed: isAdult,
      // The directory is only for adults who opted in.
      directory_opt_in: isAdult && form.get("directory_opt_in") === "on",
      is_hidden: form.get("is_hidden") === "on",
    })
    .eq("id", auth.user.id);

  if (error?.code === "23505") return { fieldErrors: { username: "That username is taken." } };
  if (error) return { error: `Your profile didn't save: ${error.message}` };

  revalidatePath("/", "layout");
  redirect(`/profile/${username}`);
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
