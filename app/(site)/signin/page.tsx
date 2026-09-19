import type { Metadata } from "next";
import { SignInForm } from "@/components/profile/SignInForm";
import { googleSignInEnabled } from "@/lib/supabase/authProviders";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  // The welcome popup's "Create an account" lands straight on the sign-up form.
  return <SignInForm next={next} linkError={params.error === "link"} initialMode={params.mode === "signup" ? "signup" : "signin"} googleEnabled={await googleSignInEnabled()} />;
}
