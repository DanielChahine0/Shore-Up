"use client";

import { MAX_PER_ITEM, TRASH_ITEMS, type TrashCounts, type TrashItemKey } from "@/lib/trash/config";
import { MinusIcon, PlusIcon, TRASH_ICONS } from "./icons";

const step = "flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-tint disabled:border-line/60 disabled:text-ink-soft/50 disabled:hover:bg-transparent";

type Props = {
  counts: TrashCounts;
  onAdjust: (key: TrashItemKey, delta: number) => void;
};

/** The twelve tallies. Each one carries its own count on the icon. */
export function ItemGrid({ counts, onAdjust }: Props) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TRASH_ITEMS.map((item) => {
        const count = counts[item.key] ?? 0;
        const Icon = TRASH_ICONS[item.key];
        return (
          // A two-line name like "Something else" must not push its buttons out of line with the row.
          <li key={item.key} role="group" aria-label={`${item.name}: ${count}`} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-2.5">
            <div className="flex flex-col items-center gap-1.5">
              <span className="relative">
                <Icon className={`h-7 w-7 ${count > 0 ? "text-brand-strong" : "text-ink-soft"}`} />
                {count > 0 && (
                  <span aria-hidden className="absolute -right-2.5 -top-2 min-w-[1.25rem] rounded-full bg-brand-strong px-1 text-center text-xs font-semibold leading-5 text-white">
                    {count}
                  </span>
                )}
              </span>
              <span aria-hidden className="text-center text-xs leading-tight text-ink-soft">
                {item.name}
              </span>
            </div>
            <div className="mt-auto flex items-center justify-center gap-2 pt-2">
              <button type="button" onClick={() => onAdjust(item.key, -1)} disabled={count === 0} aria-label={`Remove one ${item.name.toLowerCase()}`} className={step}>
                <MinusIcon className="h-5 w-5" />
              </button>
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
