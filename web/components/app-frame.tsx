"use client";

import { usePathname } from "next/navigation";
import { DesktopRail } from "@/components/desktop-rail";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import type { User } from "@/lib/types";

// Global app chrome wrapper, rendered once from the root layout. It owns the
// two persistent nav surfaces — the desktop rail (lg+) and the phone bottom tab
// bar (< sm) — so they live across the primary signed-in surfaces instead of
// per-route. `children` (incl. the top NavBar) render inside the rail-padded
// column.
//
// `showShell` mirrors MobileTabBar's isPrimaryRoute idiom: only signed-in
// viewers on a primary app route get the rail + content padding. On /c/[slug],
// /login, the marketing home, etc. there's no rail and no padding. The
// lg:pl-56 only applies at lg+, so below lg there is no padding effect and the
// rail is `hidden` — mobile/tablet UX is fully preserved.
function isAppRoute(pathname: string): boolean {
  return (
    pathname === "/discover" ||
    pathname === "/add" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/u/")
  );
}

export function AppFrame({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showShell = !!user && isAppRoute(pathname);

  return (
    <>
      <div className={showShell ? "lg:pl-56" : undefined}>{children}</div>
      {showShell && user && <DesktopRail user={user} />}
      <MobileTabBar user={user} />
    </>
  );
}
