import Link from "next/link";

// The shoplit lockup: a terracotta shopping-bag mark + the serif wordmark.
// Used in the nav header (and anywhere the brand appears).
export function Logo({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="shoplit home"
      className={`group inline-flex items-center gap-2 ${className}`}
    >
      <LogoMark className="h-7 w-7 shrink-0 transition-transform duration-200 group-hover:-rotate-6" />
      <span className="font-serif text-2xl tracking-tight leading-none">shoplit</span>
    </Link>
  );
}

// Standalone mark (no wordmark) — matches app/icon.svg. Uses the page's
// --accent so it picks up the brand color.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="shoplit">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <path
        d="M24 28 a8 8 0 0 1 16 0"
        fill="none"
        stroke="#F4EBDD"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 27 h27 l2 19.2 a4.5 4.5 0 0 1-4.5 5 H21 a4.5 4.5 0 0 1-4.5-5 z"
        fill="#F4EBDD"
      />
    </svg>
  );
}
