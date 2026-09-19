"use client";

import { useSyncExternalStore } from "react";
import type { TrashItemKey } from "@/lib/trash/config";
import { GUEST_SESSIONS_KEY, IN_PROGRESS_KEY, adjustCount, newSession, parseSession, parseSessionList, type CleanSession } from "./session";

/** localStorage throws in private mode and when storage is full, so every touch is guarded. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the session still lives in the store for this page view.
  }
}

type Store = {
  /** The session running right now. */
  session: CleanSession | null;
  /** Sessions a guest finished but has not been able to save yet. */
  pending: CleanSession[];
  /** False until localStorage has been read, so the server and first client render agree. */
  restored: boolean;
};

const EMPTY: Store = { session: null, pending: [], restored: false };

// Module state rather than React state: storage is read once per page, and
// hydrating from an effect would cost an extra render on every mount.
let snapshot: Store = EMPTY;
const listeners = new Set<() => void>();

function publish(next: Store) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  // The first subscription happens after hydration, so reading storage here
  // never makes the first client render disagree with the server's.
  if (!snapshot.restored) {
    publish({ session: parseSession(read(IN_PROGRESS_KEY)), pending: parseSessionList(read(GUEST_SESSIONS_KEY)), restored: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setSession(session: CleanSession | null) {
  write(IN_PROGRESS_KEY, session ? JSON.stringify(session) : null);
  publish({ ...snapshot, session });
}

function setPending(pending: CleanSession[]) {
  write(GUEST_SESSIONS_KEY, pending.length > 0 ? JSON.stringify(pending) : null);
  publish({ ...snapshot, pending });
}

const actions = {
  start: (beach: { id: string; name: string } | null) => setSession(newSession(beach)),

  /**
   * Returns the session as it now stands. Callers announce from that rather
   * than from their own render, which lags behind a quick run of taps.
   */
  adjust: (key: TrashItemKey, delta: number): CleanSession | null => {
    if (!snapshot.session) return null;
    const next = { ...snapshot.session, counts: adjustCount(snapshot.session.counts, key, delta) };
    setSession(next);
    return next;
  },

  /** Ends the running session, whether it was saved or thrown away. */
  clear: () => setSession(null),

  /**
   * Moves the running session into the list waiting for a sign-in and returns
   * it, so the caller shows exactly what was stored.
   */
  holdForSignIn: (): CleanSession | null => {
    const { session, pending } = snapshot;
    if (!session) return null;
    setPending([...pending, session]);
    setSession(null);
    return session;
  },

  dropPending: (startedAt: string) => setPending(snapshot.pending.filter((s) => s.startedAt !== startedAt)),
};

/**
 * The clean session running on this device. It is kept in localStorage so a
 * reload does not lose a tally, and so guests can finish a session and save it
 * after signing in.
 */
export function useCleanSession() {
  const store = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
  return { ...store, ...actions };
}
