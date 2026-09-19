/**
 * The items a volunteer can tally in a clean session.
 * Keys are stored in clean_session_items.item_key; keep them in step with
 * trash_item_keys() in supabase/migrations/0005_clean_sessions_events.sql.
 */
export const TRASH_ITEMS = [
  { key: "plastic_bottle", name: "Plastic bottle" },
  { key: "bottle_cap", name: "Bottle cap" },
  { key: "cigarette_butt", name: "Cigarette butt" },
  { key: "food_wrapper", name: "Food wrapper" },
  { key: "plastic_bag", name: "Plastic bag" },
  { key: "can", name: "Can" },
  { key: "glass", name: "Glass" },
  { key: "straw", name: "Straw" },
  { key: "fishing_gear", name: "Fishing gear" },
  { key: "foam", name: "Foam piece" },
  { key: "paper", name: "Paper" },
  { key: "other", name: "Something else" },
] as const;

export type TrashItemKey = (typeof TRASH_ITEMS)[number]["key"];
export type TrashCounts = Partial<Record<TrashItemKey, number>>;

export const MAX_PER_ITEM = 500;

export function totalItems(counts: TrashCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** What log_clean_session returns. */
export type CleanSessionResult = {
  sessionId: string;
  totalItems: number;
  lifetimeItems: number;
  unlockedNow: boolean;
  newAchievements: string[];
};
