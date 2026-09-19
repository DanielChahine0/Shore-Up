"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { updateProfile, type ProfileFormState } from "@/app/actions/profile";
import { Avatar } from "@/components/ui/Avatar";
import { MODE_LABELS, MODES } from "@/lib/profiles/modes";
import type { OwnProfile } from "@/lib/profiles/queries";

const field = "mt-1 w-full rounded-xl border border-line bg-navy px-3 text-sm text-shell placeholder:text-mist";

export function ProfileForm({ profile }: { profile: OwnProfile }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const [isAdult, setIsAdult] = useState(profile.is_adult_confirmed);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [upload, setUpload] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setUpload({ busy: false, error: "Photos can be up to 5 MB each." });
    setUpload({ busy: true, error: null });
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) return setUpload({ busy: false, error: json.error ?? "The photo didn't upload. Try again." });
      setAvatarUrl(json.url);
      setUpload({ busy: false, error: null });
    } catch {
      setUpload({ busy: false, error: "The photo didn't upload. Check your connection and try again." });
    }
  };

  return (
    <form action={action} className="mt-6 space-y-8">
      <section className="flex items-center gap-4">
        <Avatar name={displayName} src={avatarUrl} size={72} />
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.busy} className="rounded-full border border-line px-4 py-2 text-sm text-shell disabled:opacity-60">
            {upload.busy ? "Uploading" : avatarUrl ? "Change photo" : "Add a photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickPhoto} className="sr-only" aria-label="Profile photo" />
          <p className="mt-1.5 text-xs text-mist">JPG, PNG, or WebP up to 5 MB. Location data is removed from every photo.</p>
          {upload.error && (
            <p role="alert" className="mt-1 text-xs text-shell">
              {upload.error}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <Field label="Display name" error={state.fieldErrors?.display_name}>
          <input name="display_name" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={`${field} h-11`} />
        </Field>
        <Field label="Username" hint="Your profile address. Lowercase letters, numbers, and underscores." error={state.fieldErrors?.username}>
          <input name="username" required defaultValue={profile.username} pattern="[a-z0-9_]{3,30}" autoCapitalize="none" className={`${field} h-11`} />
        </Field>
        <Field label="Area" hint="City or neighbourhood only. Shore Up never shows or stores your exact location." error={state.fieldErrors?.area}>
          <input name="area" defaultValue={profile.area} maxLength={80} placeholder="The Beaches, Toronto" className={`${field} h-11`} />
        </Field>
        <Field label="Bio" error={state.fieldErrors?.bio}>
          <textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={4} className={`${field} py-2.5`} />
        </Field>
      </section>

      <fieldset>
        <legend className="text-sm font-semibold text-shell">Current mode</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-sm text-shell has-checked:border-foam/70 has-checked:bg-foam/10">
              <input type="radio" name="mode" value={mode} defaultChecked={profile.mode === mode} className="h-4 w-4 accent-[#8fe3d0]" />
              {MODE_LABELS[mode]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-shell">Visibility</legend>
        <Check name="is_adult_confirmed" checked={isAdult} onChange={setIsAdult} label="I am 18 or older" hint="Required before your profile can be seen by anyone else." />
        <Check
          name="directory_opt_in"
          defaultChecked={profile.directory_opt_in}
          disabled={!isAdult}
          label="List me in the People directory"
          hint="Shows your name, area, mode, and next planned cleanup so volunteers can find you."
        />
        <Check name="is_hidden" defaultChecked={profile.is_hidden} label="Hide my profile" hint="Nobody else can see your profile or find you in the directory." />
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-xl border border-line bg-navy px-3 py-2 text-sm text-shell">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="h-11 rounded-full bg-foam px-6 text-sm font-semibold text-foam-deep disabled:opacity-60">
          {pending ? "Saving" : "Save profile"}
        </button>
        <Link href={`/profile/${profile.username}`} className="text-sm text-mist hover:text-shell">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-shell">
      {label}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-mist">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-shell">
          {error}
        </span>
      )}
    </label>
  );
}

type CheckProps = { name: string; label: string; hint: string; disabled?: boolean; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void };

function Check({ name, label, hint, disabled, defaultChecked, checked, onChange }: CheckProps) {
  return (
    <label className={`flex items-start gap-2.5 text-sm text-shell ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        name={name}
        disabled={disabled}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 accent-[#8fe3d0]"
      />
      <span>
        {label}
        <span className="block text-xs text-mist">{hint}</span>
      </span>
    </label>
  );
}
