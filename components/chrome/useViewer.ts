"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Viewer = { id: string; username: string; displayName: string; avatarUrl: string | null };

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
    const load = async (userId: string | undefined) => {
      if (!userId) return setViewer(null);
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", userId).maybeSingle();
      if (cancelled) return;
      setViewer(data ? { id: data.id, username: data.username, displayName: data.display_name, avatarUrl: data.avatar_url } : null);
    };
    supabase.auth.getUser().then(({ data }) => load(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => load(session?.user.id));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}
