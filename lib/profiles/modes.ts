export type UserMode = "looking_for_volunteers" | "joining" | "solo" | "break";

/** Labels on a person's own profile. */
export const MODE_LABELS: Record<UserMode, string> = {
  looking_for_volunteers: "Looking for volunteers",
  joining: "Joining a cleanup",
  solo: "Solo",
  break: "Taking a break",
};

/** Badges in the people directory. People taking a break are not listed. */
export const DIRECTORY_MODE_LABELS: Record<Exclude<UserMode, "break">, string> = {
  looking_for_volunteers: "Looking for volunteers",
  joining: "Joining others",
  solo: "Solo",
};

export const MODES = Object.keys(MODE_LABELS) as UserMode[];
