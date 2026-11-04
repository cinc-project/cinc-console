import type { ReactNode } from "react";

/**
 * Line-art spot illustrations for empty states. Inline SVG (the console runs
 * air-gapped, so no image CDN) drawn in theme tokens: the main strokes follow
 * `currentColor` (EmptyState sets it to the link color), secondary strokes are
 * muted, and accents use primary/success. Purely decorative — EmptyState wraps
 * them in aria-hidden, and the headline beside them carries the meaning.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      width="96"
      height="72"
      viewBox="0 0 96 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const MUTED = "stroke-muted";

/** A rack with one live server and two empty, dashed slots. */
export function NodesIllustration() {
  return (
    <Frame>
      <rect x="20" y="10" width="56" height="14" rx="3" />
      <circle cx="29" cy="17" r="1.8" className="fill-success stroke-none" />
      <path d="M62 17h8" />
      <rect x="20" y="29" width="56" height="14" rx="3" strokeDasharray="4 3" className={MUTED} />
      <rect x="20" y="48" width="56" height="14" rx="3" strokeDasharray="4 3" className={MUTED} />
      <path d="M48 33v6M45 36h6" className="stroke-primary" />
    </Frame>
  );
}

/** A person with a bundle of recipe lines around them. */
export function RolesIllustration() {
  return (
    <Frame>
      <circle cx="48" cy="22" r="9" />
      <path d="M32 58c2-10 9-16 16-16s14 6 16 16" />
      <path d="M16 28h10M70 28h10M20 42h7M69 42h7" className={MUTED} />
    </Frame>
  );
}

/** Stages as buildings on a skyline, with one more stage still to build. */
export function EnvironmentsIllustration() {
  return (
    <Frame>
      <path d="M12 60h72" className={MUTED} />
      <path d="M20 60V38l10-8 10 8v22" />
      <path d="M44 60V44l6-5 6 5v16" strokeDasharray="3 3" className={MUTED} />
      <path d="M60 60V26l10-8 10 8v34" />
    </Frame>
  );
}

/** A bag holding a couple of data lines. */
export function DataBagsIllustration() {
  return (
    <Frame>
      <path d="M26 26h44l-4 34H30z" />
      <path d="M38 26v-6a10 10 0 0 1 20 0v6" />
      <path d="M40 40h16M42 48h12" className={MUTED} />
    </Frame>
  );
}

/** An open book. */
export function CookbooksIllustration() {
  return (
    <Frame>
      <path d="M18 16h22a8 8 0 0 1 8 8v36a6 6 0 0 0-6-6H18z" />
      <path d="M78 16H56a8 8 0 0 0-8 8v36a6 6 0 0 1 6-6h24z" />
      <path d="M24 26h16M24 33h12M56 26h16M56 33h10" className={MUTED} />
    </Frame>
  );
}

/** A locked-in document with a check mark. */
export function PoliciesIllustration() {
  return (
    <Frame>
      <path d="M30 10h28l12 12v40H30z" />
      <path d="M58 10v12h12" />
      <path d="M38 36l6 6 12-12" className="stroke-success" />
      <path d="M38 52h20" className={MUTED} />
    </Frame>
  );
}

/** A terminal window: an API identity. */
export function ClientsIllustration() {
  return (
    <Frame>
      <rect x="16" y="14" width="64" height="44" rx="4" />
      <path d="M16 24h64" className={MUTED} />
      <path d="M26 34l7 6-7 6M38 46h12" />
    </Frame>
  );
}
