"use client";

export type EventsMenuProps = {
  signedIn: boolean;
  onPickBeach: (beachId: string) => void;
  onToast: (message: string) => void;
};

/** Left side panel listing public cleanups near the visitor's chosen place. */
export function EventsMenu(_props: EventsMenuProps) {
  return null;
}
