"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Home,
  Plus,
  Rss,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import type { User } from "@/lib/types";

// Fixed desktop nav rail. Rendered (via AppFrame) only for signed-in viewers on
// the primary app routes, and only at lg+ — it's `hidden` below lg so the
// mobile/tablet UX (top bar + drawer + phone bottom bar) is untouched. It sits
// just below the sticky top NavBar (top-[57px] ≈ NavBar height) and gives
// one-click navigation between the primary surfaces. Nav-only by design:
// account / sign-out stay in the top-bar avatar drawer (AppSidebar).
export function DesktopRail({ user }: { user: User }) {
  const pathname = usePathname();
  const profileHref = user.handle ? `/u/${user.handle}` : null;

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden lg:flex flex-col fixed left-0 top-[57px] bottom-0 w-56 z-30 border-r border-rule bg-cream overflow-y-auto py-4 px-3"
    >
      <RailLink
        href="/dashboard"
        label="Dashboard"
        icon={<Home size={18} />}
        active={pathname === "/dashboard"}
      />
      <RailLink
        href="/discover"
        label="Discover"
        icon={<Compass size={18} />}
        active={pathname === "/discover"}
      />
      <RailLink
        href="/dashboard/following"
        label="Your feed"
        icon={<Rss size={18} />}
        active={pathname === "/dashboard/following"}
      />
      {profileHref && (
        <RailLink
          href={profileHref}
          label="Your profile"
          icon={<UserIcon size={18} />}
          active={pathname === profileHref}
        />
      )}
      <RailLink
        href="/add"
        label="New cart"
        icon={<Plus size={18} />}
        active={pathname === "/add"}
      />

      {user.isAdmin && (
        <>
          <div className="my-2 h-px bg-rule" aria-hidden="true" />
          <RailLink
            href="/dashboard/admin"
            label="Admin"
            icon={<ShieldCheck size={18} />}
            active={pathname.startsWith("/dashboard/admin")}
          />
        </>
      )}
    </nav>
  );
}

function RailLink({
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
      className={`flex items-center gap-3 min-h-[44px] px-3 rounded-md text-sm transition-colors ${
        active
          ? "bg-paper text-accent font-medium"
          : "text-muted hover:bg-paper hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
