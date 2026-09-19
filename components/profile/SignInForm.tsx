"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

const field = "h-11 w-full rounded-xl border border-line bg-navy px-3 text-sm text-shell placeholder:text-mist";

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "That sign-in link didn't work or has expired. Try again." : null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  if (!supabase) {
    return (
      <Card title="Sign-in isn't set up yet">
        <p className="text-sm leading-relaxed text-mist">
          Add <code className="text-shell">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-shell">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="text-shell">.env.local</code>, then restart the dev server. The README has the steps.
        </p>
      </Card>
    );
  }

  if (checkEmail) {
    return (
      <Card title="Check your email">
        <p className="text-sm leading-relaxed text-mist">
          We sent a confirmation link to <span className="text-shell">{checkEmail}</span>. Open it on this device to finish signing up.
        </p>
      </Card>
    );
  }

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    setPending(true);
    setError(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setPending(false);
        return setError(error.message === "Invalid login credentials" ? "That email and password don't match an account." : error.message);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl(),
          data: { display_name: String(form.get("display_name")).trim(), is_adult_confirmed: form.get("is_adult_confirmed") === "on" },
        },
      });
      if (error) {
        setPending(false);
        return setError(error.message);
      }
      if (!data.session) {
        setPending(false);
        return setCheckEmail(email);
      }
    }
    router.push(next);
    router.refresh();
  };

  const withGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error) setError("Google sign-in isn't available right now. Use email instead.");
  };

  const signup = mode === "signup";
  return (
    <Card title={signup ? "Join Shore Up" : "Sign in to Shore Up"}>
      <p className="text-sm text-mist">{signup ? "Post cleanups, join a community, and find volunteers near you." : "Welcome back."}</p>

      <button type="button" onClick={withGoogle} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line text-sm font-medium text-shell hover:bg-navy">
        <GoogleMark />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-mist">
        <span className="h-px flex-1 bg-line" />
        or use email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {signup && (
          <label className="block text-sm text-shell">
            Display name
            <input name="display_name" required maxLength={60} autoComplete="name" className={`${field} mt-1`} />
          </label>
        )}
        <label className="block text-sm text-shell">
          Email
          <input name="email" type="email" required autoComplete="email" className={`${field} mt-1`} />
        </label>
        <label className="block text-sm text-shell">
          Password
          <input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} className={`${field} mt-1`} />
          {signup && <span className="mt-1 block text-xs text-mist">At least 8 characters.</span>}
        </label>
        {signup && (
          <label className="flex items-start gap-2.5 pt-1 text-sm text-shell">
            <input name="is_adult_confirmed" type="checkbox" className="mt-0.5 h-4 w-4 accent-[#8fe3d0]" />
            <span>
              I am 18 or older.
              <span className="block text-xs text-mist">Only adults can appear publicly. You can still use Shore Up privately without this.</span>
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-line bg-navy px-3 py-2 text-sm text-shell">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending} className="h-11 w-full rounded-full bg-foam text-sm font-semibold text-foam-deep disabled:opacity-60">
          {pending ? "One moment" : signup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-mist">
        {signup ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setError(null);
          }}
          className="font-medium text-foam"
        >
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-line bg-navy/60 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-shell">{title}</h1>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.700h5.400a4.600 4.600 0 0 1-2 3v2.500h3.200c1.900-1.700 3-4.300 3-7.300Z" />
      <path d="M12 22c2.700 0 5-.9 6.600-2.500l-3.200-2.500c-.9.600-2 1-3.400 1-2.600 0-4.800-1.800-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22Z" opacity=".75" />
      <path d="M6.400 13.900a6 6 0 0 1 0-3.800V7.500H3.100a10 10 0 0 0 0 9l3.300-2.600Z" opacity=".55" />
      <path d="M12 6c1.500 0 2.800.500 3.800 1.500l2.900-2.800A10 10 0 0 0 3.100 7.500l3.300 2.600C7.200 7.800 9.400 6 12 6Z" opacity=".9" />
    </svg>
  );
}
