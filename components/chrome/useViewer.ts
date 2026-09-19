"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Viewer = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** The first community they joined, opened by the community button. */
  community: { id: string; slug: string; name: string } | null;
};

const listeners = new Set<() => void>();

/** Call after something the header shows has changed (joining or leaving a community, a new avatar). */
export function refreshViewer() {
  listeners.forEach((reload) => reload());
}

/** undefined while loading, null when signed out. */
export function useViewer(): Viewer | null | undefined {
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      queueMicrotask(() => setViewer(null));
      return;
    }
    let cancelled = false;
    let currentUserId: string | undefined;

    const load = async (userId: string | undefined) => {
      currentUserId = userId;
      if (!userId) return setViewer(null);
      const [profile, membership] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("community_members").select("joined_at, communities(id, slug, name)").eq("user_id", userId).order("joined_at").limit(1),
      ]);
      if (cancelled) return;
      const community = (membership.data?.[0] as unknown as { communities: Viewer["community"] } | undefined)?.communities ?? null;
      setViewer(
        profile.data
          ? { id: profile.data.id, username: profile.data.username, displayName: profile.data.display_name, avatarUrl: profile.data.avatar_url, community }
          : null,
      );
    };

    const reload = () => void load(currentUserId);
    listeners.add(reload);
    supabase.auth.getUser().then(({ data, error }) => {
      // A session for an account that no longer exists: clear it on this device and carry on signed out.
      if (error && !data.user) void supabase.auth.signOut({ scope: "local" });
      void load(data.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => void load(session?.user.id));
    return () => {
      cancelled = true;
      listeners.delete(reload);
      sub.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}
