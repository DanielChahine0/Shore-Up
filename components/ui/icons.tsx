type IconProps = { className?: string };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Two people, traced from the owner's community icon. Solid, unlike the line icons, to match the source. */
export function CommunityIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="9.45" cy="8.13" r="4.15" />
      <path d="M2.37 19.97a7.09 6.5 0 0 1 14.18 0Z" />
      <path d="M14.23 5.84A3.26 3.26 0 1 1 13.86 11.06A5.3 5.3 0 0 0 14.23 5.84Z" />
      <path d="M13.85 13.5C14.5 13.15 15.3 13 16 13c3 0 5.2 2.2 5.6 5H17.4c-.6-1.9-1.8-3.4-3.55-4.5Z" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2" />
    </svg>
  );
}

export function WaveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 9c2.2 0 2.2 2 4.5 2S9.800 9 12 9s2.2 2 4.5 2S18.800 9 21 9M3 15c2.2 0 2.2 2 4.5 2s2.3-2 4.5-2 2.2 2 4.5 2 2.3-2 4.5-2" />
    </svg>
  );
}
