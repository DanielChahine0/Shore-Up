/* eslint-disable @next/next/no-img-element -- avatars come from Supabase Storage at a fixed small size */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A person's photo, or their initials when they have none. */
export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) return <img src={src} alt="" width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-full bg-tint font-semibold text-ink">
      {initials(name)}
    </span>
  );
}
