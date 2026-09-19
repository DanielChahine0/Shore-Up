import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processImage, UploadError } from "@/lib/images/process";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Avatar upload. The image is validated, stripped of EXIF, and re-encoded on
 * the server before it is stored. Post photos are added here in phase 3.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });

  let webp: Buffer;
  try {
    webp = await processImage(file, "avatar");
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const admin = supabaseAdmin();
  const path = `${auth.user.id}/${randomUUID()}.webp`;
  const upload = await admin.storage.from("avatars").upload(path, webp, { contentType: "image/webp", cacheControl: "31536000" });
  if (upload.error) return NextResponse.json({ error: "The photo didn't upload. Try again." }, { status: 500 });

  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  // Written as the user, so Row Level Security still guards the profile row.
  const saved = await supabase.from("profiles").update({ avatar_url: url }).eq("id", auth.user.id);
  if (saved.error) return NextResponse.json({ error: "The photo uploaded but didn't save to your profile." }, { status: 500 });

  return NextResponse.json({ url });
}
