"use client";

import type { PlaceResult } from "@/components/chrome/SearchBar";

export type WelcomeDialogProps = {
  mapboxToken: string;
  signedIn: boolean;
  /** Flies the map to the chosen place. */
  onPickPlace: (place: PlaceResult) => void;
};

/** First-visit popup: sign up or continue as a guest, then choose a place. */
export function WelcomeDialog(_props: WelcomeDialogProps) {
  return null;
}
