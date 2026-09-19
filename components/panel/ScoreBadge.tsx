import { bandFor } from "@/lib/scores/compute";

/** Score number plus band label, always together, so color is never the only signal. */
export function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const band = bandFor(score);
  const lg = size === "lg";
  return (
    <span
      className={`inline-flex shrink-0 items-baseline gap-1.5 rounded-full font-semibold tabular-nums ${lg ? "px-3.5 py-1 text-base" : "px-2.5 py-0.5 text-xs"}`}
      style={{ background: band.color, color: band.textOn }}
    >
      <span>{score}</span>
      <span className="font-medium">{band.label}</span>
    </span>
  );
}
