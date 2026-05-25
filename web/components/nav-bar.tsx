"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import type { User } from "@/lib/types";

interface NavBarProps {
  variant?: "marketing" | "app";
  /** User passed down from the server-rendered layout. Required when variant="app". */
  user?: User | null;
}

// NavBar no longer fetches the user itself. The dashboard layout (server
// component) gets the user via `getCurrentUser({ cookie })` and passes it
// in. This avoids a duplicate client-side fetch AND prevents the previous
// bug where a transient client fetch failure would `router.push("/login")`
// and ping-pong the user between /dashboard ↔ /login.
//
// The right side is now a single, consistent surface on every page: the
// AppSidebar trigger (avatar when signed in, ☰ when logged out). Logged-out
// marketing also keeps the "Start free" pill to the left of the trigger.
export function NavBar({ variant = "marketing", user = null }: NavBarProps) {
  return (
    <nav className="border-b border-rule bg-cream/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
        <Logo href={variant === "app" ? "/dashboard" : "/"} />
        <div className="flex items-center gap-3">
          {variant === "marketing" && !user && (
            <Link
              href="/login"
              className="rounded-full bg-ink text-cream px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          )}
          {/* In-app new-cart bell. Shown on every page (both variants) when
              signed in, just before the account control. Hidden logged-out. */}
          {user && <NotificationBell />}
          <AppSidebar user={user} />
        </div>
      </div>
    </nav>
  );
}
