/**
 * One simple line icon per key in TRASH_ITEMS. They are drawn on a 24x24 grid
 * in the same stroke style as components/ui/icons.tsx, and they accept raw SVG
 * props so the bag can nest them at a given x/y (nested <svg> keeps its viewBox).
 */

import type { TrashItemKey } from "@/lib/trash/config";

type IconProps = React.SVGProps<SVGSVGElement>;

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function PlasticBottleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2h4v2.5c0 1 1.5 1.6 1.5 3.5v11a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3V8c0-1.9 1.5-2.5 1.5-3.5Z" />
      <path d="M8.5 11h7" />
    </svg>
  );
}

function BottleCapIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </svg>
  );
}

function CigaretteButtIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="12" width="18" height="5" rx="2.5" />
      <path d="M15 12v5" />
      <path d="M7 9c0-2 2-2 2-4" />
    </svg>
  );
}

function FoodWrapperIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 7h10l-1.5 5 1.5 5H7l1.5-5Z" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

function PlasticBagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 8h12l-1 13H7Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function CanIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M7 7h10M7 17h10" />
    </svg>
  );
}

function GlassIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3h8l-1 8a3 3 0 0 1-6 0Z" />
      <path d="M12 14v6M9 21h6" />
    </svg>
  );
}

function StrawIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 3 9 21" />
      <path d="M8 3 5 12" />
      <path d="M5 12h5" />
    </svg>
  );
}

function FishingGearIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5v9a5 5 0 0 0 10 0" />
      <path d="M14 14a3 3 0 0 0 6 0V6" />
      <path d="M2 5h4" />
    </svg>
  );
}

function FoamIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="10" r="4" />
      <circle cx="15.5" cy="14" r="3.5" />
      <circle cx="16" cy="7.5" r="2.5" />
    </svg>
  );
}

function PaperIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function OtherIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h14l-1.2 13.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8Z" />
      <path d="M3 7h18M9.5 7V4h5v3" />
    </svg>
  );
}

export const TRASH_ICONS: Record<TrashItemKey, (props: IconProps) => React.ReactElement> = {
  plastic_bottle: PlasticBottleIcon,
  bottle_cap: BottleCapIcon,
  cigarette_butt: CigaretteButtIcon,
  food_wrapper: FoodWrapperIcon,
  plastic_bag: PlasticBagIcon,
  can: CanIcon,
  glass: GlassIcon,
  straw: StrawIcon,
  fishing_gear: FishingGearIcon,
  foam: FoamIcon,
  paper: PaperIcon,
  other: OtherIcon,
};

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 12h12" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

/** The bag on the button and at the top of the sheet. */
export function BagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.5c1.2-1 6.8-1 8 0L14.5 7h-5Z" />
      <path d="M9.5 7C6 9 4.5 13 5 17a4 4 0 0 0 3.2 3.7 18 18 0 0 0 7.6 0A4 4 0 0 0 19 17c.5-4-1-8-4.5-10Z" />
    </svg>
  );
}
