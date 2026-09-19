"use client";

import { MAX_PER_ITEM, TRASH_ITEMS, type TrashCounts, type TrashItemKey } from "@/lib/trash/config";
import { MinusIcon, PlusIcon, TRASH_ICONS } from "./icons";

const step = "flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-tint disabled:border-line/60 disabled:text-ink-soft/50 disabled:hover:bg-transparent";

type Props = {
  counts: TrashCounts;
  onAdjust: (key: TrashItemKey, delta: number) => void;
};

/** The twelve tallies. Each count sits between its two buttons, so the pair spans the card at any width. */
export function ItemGrid({ counts, onAdjust }: Props) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {TRASH_ITEMS.map((item) => {
        const count = counts[item.key] ?? 0;
        const Icon = TRASH_ICONS[item.key];
        return (
          // A two-line name like "Something else" must not push its buttons out of line with the row.
          <li key={item.key} role="group" aria-label={`${item.name}: ${count}`} className={`flex h-full flex-col rounded-2xl border bg-surface p-3 transition-colors ${count > 0 ? "border-brand-strong" : "border-line"}`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-6 w-6 shrink-0 ${count > 0 ? "text-brand-strong" : "text-ink-soft"}`} />
              <span aria-hidden className="min-w-0 text-sm font-medium leading-tight text-ink">
                {item.name}
              </span>
            </div>
            <div className="mt-auto flex items-center justify-between pt-3">
              <button type="button" onClick={() => onAdjust(item.key, -1)} disabled={count === 0} aria-label={`Remove one ${item.name.toLowerCase()}`} className={step}>
                <MinusIcon className="h-5 w-5" />
              </button>
              <span aria-hidden className={`text-lg font-semibold tabular-nums ${count > 0 ? "text-ink" : "text-ink-soft"}`}>
                {count}
              </span>
              <button type="button" onClick={() => onAdjust(item.key, 1)} disabled={count >= MAX_PER_ITEM} aria-label={`Add one ${item.name.toLowerCase()}`} className={step}>
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
