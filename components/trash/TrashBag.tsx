"use client";

import { TRASH_ITEMS, totalItems, type TrashCounts, type TrashItemKey } from "@/lib/trash/config";
import { TRASH_ICONS } from "./icons";
import { itemLabel } from "./session";

/** How many items read as a full bag. Past this the fill just stays full. */
const FULL_AT = 20;
/** Where item icons sit inside the bag, bottom row first. Widths follow the bag's shape. */
const ROWS = [
  { y: 84, slots: 4 },
  { y: 67, slots: 4 },
  { y: 50, slots: 3 },
  { y: 34, slots: 2 },
] as const;
const TOKEN = 15;
const SPACING = 19;
const ORDER = TRASH_ITEMS.map((item) => item.key);
/** The surface of the fill: two full waves wider than the bag, so it can slide one wave sideways without a gap. */
const WAVE = "M-40 0q10-3 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0V120H-40Z";
const WAVE_LINE = "M-40 0q10-3 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0";

/** One icon per item collected, most-collected first, up to what the bag can show. */
function tokensFor(counts: TrashCounts): TrashItemKey[] {
  const ranked = ORDER.filter((key) => (counts[key] ?? 0) > 0).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  const capacity = ROWS.reduce((sum, row) => sum + row.slots, 0);
  const tokens: TrashItemKey[] = [];
  // Round robin, so a bag of 30 bottles and 1 straw still shows the straw.
  for (let pass = 0; tokens.length < capacity && ranked.some((key) => (counts[key] ?? 0) > pass); pass += 1) {
    for (const key of ranked) {
      if (tokens.length >= capacity) break;
      if ((counts[key] ?? 0) > pass) tokens.push(key);
    }
  }
  return tokens;
}

/** Spreads the tokens across the rows, centering each row inside the bag. */
function layOut(tokens: TrashItemKey[]) {
  const placed: { key: TrashItemKey; id: string; x: number; y: number }[] = [];
  let taken = 0;
  for (const row of ROWS) {
    const inRow = tokens.slice(taken, taken + row.slots);
    taken += inRow.length;
    const startX = 60 - ((inRow.length - 1) * SPACING) / 2 - TOKEN / 2;
    inRow.forEach((key, i) => placed.push({ key, id: `${row.y}-${i}`, x: startX + i * SPACING, y: row.y }));
  }
  return placed;
}

/**
 * The garbage bag at the top of the sheet: it fills up and shows what went in.
 * Decorative, so it is hidden from screen readers; the running total beside it
 * is the accessible readout.
 */
export function TrashBag({ counts }: { counts: TrashCounts }) {
  const total = totalItems(counts);
  const ratio = Math.min(1, total / FULL_AT);
  const fillTop = 106 - ratio * 82;
  const laidOut = layOut(tokensFor(counts));

  return (
    <svg viewBox="0 0 120 116" aria-hidden className="h-28 w-auto shrink-0 text-ink-soft" role="presentation">
      <defs>
        <clipPath id="trash-bag-body">
          <path d="M48 20C26 32 18 60 20 80c2 20 18 30 40 30s38-10 40-30c2-20-6-48-28-60Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#trash-bag-body)">
        <rect x="0" y="0" width="120" height="116" className="fill-surface" />
        {/* The level rises with a little overshoot, and the surface sloshes once per change, then rests. */}
        <g className="bag-level" style={{ transform: `translateY(${fillTop}px)` }}>
          <g key={total} className="bag-slosh">
            <path d={WAVE} className="fill-brand-strong/25" />
            {/* A line along the surface, so the level reads without relying on the tint. */}
            <path d={WAVE_LINE} fill="none" strokeWidth="2" className="stroke-brand-strong" />
          </g>
        </g>
        {/* Slots keep their keys, so only a newly filled slot drops in. */}
        {laidOut.map((token) => {
          const Icon = TRASH_ICONS[token.key];
          return (
            <g key={token.id} className="bag-drop">
              <Icon x={token.x} y={token.y} width={TOKEN} height={TOKEN} className="text-brand-strong" />
            </g>
          );
        })}
      </g>

      {/* Tie and outline give a small squash as each item lands. */}
      <g key={`outline-${total}`} className={total > 0 ? "bag-squash" : undefined}>
        <path d="M44 6c8-5 24-5 32 0l-4 14H48Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />

      <path
        d="M48 20C26 32 18 60 20 80c2 20 18 30 40 30s38-10 40-30c2-20-6-48-28-60Z"
        fill="none"
        stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** The number beside the bag. Announced separately, so this copy is decorative. */
export function BagTotal({ counts }: { counts: TrashCounts }) {
  const total = totalItems(counts);
  return (
    <p aria-hidden className="text-2xl font-semibold tracking-tight text-ink">
      <span key={total} className={`inline-block ${total > 0 ? "bag-count" : ""}`}>
        {itemLabel(total)}
      </span>
      <span className="ml-2 align-middle text-sm font-normal text-ink-soft">in the bag</span>
    </p>
  );
}
