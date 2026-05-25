"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Home, Plus, Rss, User as UserIcon } from "lucide-react";
import type { User } from "@/lib/types";

// Global mobile tab bar. Rendered once from the root layout (not per-route),
// so it persists across the primary signed-in surfaces — Dashboard (/dashboard*),
// Discover (/discover, public), Add (/add, top-level) and profiles (/u/*) —
// instead of vanishing the moment you leave /dashboard*. Hidden at sm+ (the top
// NavBar covers desktop). Account / sign-out live in the AppSidebar drawer.
//
// Five slots so the raised `+` sits dead-center (2 · + · 2). When the viewer
// has no handle the Profile tab is omitted and a balanced spacer keeps `+`
// centered.
//
// Visibility: only for signed-in viewers, and only on a "primary" route. On
// /c/[slug], /login, the marketing home, legal, etc. it renders null.
function isPrimaryRoute(pathname: string): boolean {
  return (
    pathname === "/discover" ||
    pathname === "/add" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/u/")
  );
}

export function MobileTabBar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const authed = !!user;

  if (!authed || !isPrimaryRoute(pathname)) return null;

  const profileHref = user?.handle ? `/u/${user.handle}` : null;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-rule bg-cream sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-16 px-2">
        <NavItem
          href="/dashboard"
          label="Dashboard"
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
        {profileHref ? (
          <NavItem
            href={profileHref}
            label="Profile"
            icon={
              user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  width={20}
                  height={20}
                  alt=""
                  className={`rounded-full ${
                    pathname === profileHref
                      ? "ring-2 ring-accent"
                      : "border border-rule"
                  }`}
                  unoptimized
                />
              ) : (
                <UserIcon size={20} />
              )
            }
            active={pathname === profileHref}
          />
        ) : (
          // Balanced spacer keeps the `+` dead-center when there's no profile.
          <div aria-hidden="true" className="flex-1" />
        )}
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
