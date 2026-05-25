"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Plus, Rss } from "lucide-react";

// Sticky bottom nav for /dashboard* on mobile only. Hidden at sm+ (the top
// NavBar covers desktop). Destinations: Carts / Discover / Add (center) /
// Following. Sign-out lives in the top-right avatar dropdown.
export function MobileBottomNav() {
  const pathname = usePathname();

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
        <CenterAction href="/add" />
        <NavItem
          href="/dashboard/following"
          label="Following"
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
      className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      <span className="text-[11px] leading-none">{label}</span>
    </Link>
  );
}

function CenterAction({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Add a product"
      className="-translate-y-3 flex items-center justify-center w-14 h-14 rounded-full bg-ink text-cream shadow-lg hover:opacity-90 transition-opacity"
    >
      <Plus size={22} />
    </Link>
  );
}
