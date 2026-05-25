"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Plus, Rss } from "lucide-react";

// Global mobile tab bar. Rendered once from the root layout (not per-route),
// so it persists across the primary signed-in surfaces — Carts (/dashboard*),
// Discover (/discover, public) and Add (/add, top-level) — instead of vanishing
// the moment you leave /dashboard*. Hidden at sm+ (the top NavBar covers
// desktop). Sign-out lives in the top-right avatar dropdown.
//
// Visibility: only for signed-in viewers, and only on a "primary" route. On
// /c/[slug], /login, the marketing home, legal, etc. it renders null.
function isPrimaryRoute(pathname: string): boolean {
  return (
    pathname === "/discover" ||
    pathname === "/add" ||
    pathname.startsWith("/dashboard")
  );
}

export function MobileTabBar({ authed }: { authed: boolean }) {
  const pathname = usePathname();

  if (!authed || !isPrimaryRoute(pathname)) return null;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-rule bg-cream/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-16 px-2">
        <NavItem
          href="/dashboard"
          label="Carts"
          icon={<Home size={20} />}
          active={pathname === "/dashboard"}
        />
        <NavItem
          href="/discover"
          label="Discover"
          icon={<Compass size={20} />}
          active={pathname === "/discover"}
        />
        <CenterAction href="/add" active={pathname === "/add"} />
        <NavItem
          href="/dashboard/following"
          label="Feed"
          icon={<Rss size={20} />}
          active={pathname === "/dashboard/following"}
        />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active ? "text-accent" : "text-muted hover:text-ink"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-0.5 bg-accent"
        />
      )}
      {icon}
      <span className="text-[11px] leading-none">{label}</span>
    </Link>
  );
}

function CenterAction({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label="Add a product"
      aria-current={active ? "page" : undefined}
      className="-translate-y-3 flex items-center justify-center w-14 h-14 rounded-full bg-ink text-cream shadow-lg hover:opacity-90 transition-opacity"
    >
      <Plus size={22} />
    </Link>
  );
}
