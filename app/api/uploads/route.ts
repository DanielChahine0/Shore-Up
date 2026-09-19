import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processImage, UploadError } from "@/lib/images/process";
import { postPhotoUrl } from "@/lib/images/urls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Photo upload for avatars and cleanup posts (form field "kind": "avatar" or "post").
 * Every image is validated, stripped of EXIF and GPS data, and re-encoded on the
 * server before it is stored. Files live under the uploader's user id.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });

  const kind = form.get("kind") === "post" ? "post" : "avatar";

  let webp: Buffer;
  try {
    webp = await processImage(file, kind);
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const admin = supabaseAdmin();
  const path = `${auth.user.id}/${randomUUID()}.webp`;

  if (kind === "post") {
    const stored = await admin.storage.from("post-photos").upload(path, webp, { contentType: "image/webp", cacheControl: "31536000" });
    if (stored.error) return NextResponse.json({ error: "The photo didn't upload. Try again." }, { status: 500 });
    return NextResponse.json({ path, url: postPhotoUrl(path) });
  }

  const upload = await admin.storage.from("avatars").upload(path, webp, { contentType: "image/webp", cacheControl: "31536000" });
  if (upload.error) return NextResponse.json({ error: "The photo didn't upload. Try again." }, { status: 500 });

  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  // Written as the user, so Row Level Security still guards the profile row.
  const saved = await supabase.from("profiles").update({ avatar_url: url }).eq("id", auth.user.id);
  if (saved.error) return NextResponse.json({ error: "The photo uploaded but didn't save to your profile." }, { status: 500 });

  return NextResponse.json({ url });
}
