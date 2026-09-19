import type { Metadata } from "next";
import { SignInForm } from "@/components/profile/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return <SignInForm next={next} linkError={params.error === "link"} />;
}
