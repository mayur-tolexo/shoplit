"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Home,
  LogOut,
  MessageSquare,
  Plus,
  Rss,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api-client";
import type { User } from "@/lib/types";

// Fixed desktop nav rail on the RIGHT (matches the right-aligned account/avatar
// surface). Rendered (via AppFrame) only for signed-in viewers on primary app
// routes, and only at lg+ — `hidden` below lg so mobile/tablet UX (top bar +
// drawer + phone bottom bar) is untouched. It sits below the sticky top NavBar
// (top-[57px]) and is self-sufficient: nav links up top, account + sign-out
// pinned at the bottom. Because the rail carries the account menu on desktop,
// NavBar hides its drawer trigger at lg+ (no duplicate nav).
export function DesktopRail({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const profileHref = user.handle ? `/u/${user.handle}` : null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      router.push("/");
    } catch {
      toast.error("Couldn't sign out.");
    }
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden lg:flex flex-col fixed right-0 top-[57px] bottom-0 w-56 z-30 border-l border-rule bg-cream overflow-y-auto py-4 px-3"
    >
      <RailLink href="/dashboard" label="Dashboard" icon={<Home size={18} />} active={pathname === "/dashboard"} />
      <RailLink href="/discover" label="Discover" icon={<Compass size={18} />} active={pathname === "/discover"} />
      <RailLink href="/dashboard/following" label="Your feed" icon={<Rss size={18} />} active={pathname === "/dashboard/following"} />
      {profileHref && (
        <RailLink href={profileHref} label="Your profile" icon={<UserIcon size={18} />} active={pathname === profileHref} />
      )}
      <RailLink href="/add" label="New cart" icon={<Plus size={18} />} active={pathname === "/add"} />
      {user.isAdmin && (
        <>
          <div className="my-2 h-px bg-rule" aria-hidden="true" />
          <RailLink href="/dashboard/admin" label="Admin" icon={<ShieldCheck size={18} />} active={pathname.startsWith("/dashboard/admin")} />
        </>
      )}

      {/* Account + secondary, pinned to the bottom. */}
      <div className="mt-auto pt-3">
        <div className="my-2 h-px bg-rule" aria-hidden="true" />
        <RailLink href="/feedback" label="Feedback" icon={<MessageSquare size={18} />} active={pathname === "/feedback"} />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 min-h-[44px] px-3 rounded-md text-sm text-muted text-left transition-colors hover:bg-paper hover:text-ink"
        >
          <LogOut size={18} />
          Sign out
        </button>
        <div className="mt-1 flex items-center gap-2 px-3 py-2 text-muted">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} width={28} height={28} alt="" className="rounded-full border border-rule shrink-0" unoptimized />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-rule text-[11px]">
              {(user.displayName || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 truncate text-xs">{user.handle ? `@${user.handle}` : user.displayName}</span>
        </div>
      </div>
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
        active ? "bg-paper text-accent font-medium" : "text-muted hover:bg-paper hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
