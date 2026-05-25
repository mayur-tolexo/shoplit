"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Rss,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api-client";
import type { User } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// The single nav + account surface. Opened from a trigger in the top NavBar,
// it renders identically on every page and breakpoint so "Dashboard" (and
// account / sign-out) is always reachable the same way. State is encapsulated
// here (the component owns both trigger and drawer), and the drawer closes on
// any navigation so it never lingers after a route change.
export function AppSidebar({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
      toast.success("Signed out");
      router.push("/");
    } catch {
      toast.error("Couldn't sign out.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {user ? (
          <button
            type="button"
            aria-label="Open menu"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Image
              src={user.avatarUrl}
              width={32}
              height={32}
              alt={user.displayName}
              className="rounded-full border border-rule"
              unoptimized
            />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Open menu"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-md text-ink outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Menu size={22} />
          </button>
        )}
      </SheetTrigger>

      <SheetContent side="left" className="flex flex-col gap-0 p-0">
        {user ? (
          <>
            <SheetHeader className="border-b border-rule p-6 pr-12">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex items-center gap-3">
                <Image
                  src={user.avatarUrl}
                  width={48}
                  height={48}
                  alt={user.displayName}
                  className="rounded-full border border-rule shrink-0"
                  unoptimized
                />
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-tight text-ink truncate">
                    {user.displayName}
                  </p>
                  {user.handle && (
                    <p className="text-sm text-muted truncate">@{user.handle}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <nav className="flex flex-col p-3">
              <DrawerLink
                href="/dashboard"
                label="Dashboard"
                icon={<Home size={18} />}
                active={pathname === "/dashboard"}
                onNavigate={() => setOpen(false)}
              />
              <DrawerLink
                href="/discover"
                label="Discover"
                icon={<Compass size={18} />}
                active={pathname === "/discover"}
                onNavigate={() => setOpen(false)}
              />
              <DrawerLink
                href="/dashboard/following"
                label="Your feed"
                icon={<Rss size={18} />}
                active={pathname === "/dashboard/following"}
                onNavigate={() => setOpen(false)}
              />
              {user.handle && (
                <DrawerLink
                  href={`/u/${user.handle}`}
                  label="Your profile"
                  icon={<UserIcon size={18} />}
                  active={pathname === `/u/${user.handle}`}
                  onNavigate={() => setOpen(false)}
                />
              )}
              <DrawerLink
                href="/add"
                label="New cart"
                icon={<Plus size={18} />}
                active={pathname === "/add"}
                onNavigate={() => setOpen(false)}
              />

              <div className="my-2 h-px bg-rule" aria-hidden="true" />

              <DrawerLink
                href="/feedback"
                label="Feedback"
                icon={<MessageSquare size={18} />}
                active={pathname === "/feedback"}
                onNavigate={() => setOpen(false)}
              />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 min-h-[44px] px-3 rounded-md text-sm text-muted text-left transition-colors hover:bg-paper hover:text-ink"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </nav>
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-rule p-6 pr-12">
              <SheetTitle className="font-serif text-xl">shoplit</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col p-3">
              <DrawerLink
                href="/discover"
                label="Discover"
                icon={<Compass size={18} />}
                active={pathname === "/discover"}
                onNavigate={() => setOpen(false)}
              />
              <DrawerLink
                href="/feedback"
                label="Feedback"
                icon={<MessageSquare size={18} />}
                active={pathname === "/feedback"}
                onNavigate={() => setOpen(false)}
              />

              <div className="my-2 h-px bg-rule" aria-hidden="true" />

              <DrawerLink
                href="/login"
                label="Sign in"
                icon={<LogIn size={18} />}
                active={pathname === "/login"}
                onNavigate={() => setOpen(false)}
              />
              <DrawerLink
                href="/login"
                label="Start free"
                icon={<Sparkles size={18} />}
                active={false}
                onNavigate={() => setOpen(false)}
              />
            </nav>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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
