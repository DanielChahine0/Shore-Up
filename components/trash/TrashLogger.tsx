"use client";

export type TrashLoggerProps = {
  /** The beach open on the map, if any, so a session can be tied to it. */
  beach: { id: string; name: string } | null;
  signedIn: boolean;
  onToast: (message: string) => void;
  onDonate: () => void;
};

/** Bottom-right "Log trash" button and the clean session sheet. */
export function TrashLogger(_props: TrashLoggerProps) {
  return null;
}
