"use client";

import { usePathname } from "next/navigation";
import { DesktopRail } from "@/components/desktop-rail";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { isAppRoute } from "@/lib/app-routes";
import type { User } from "@/lib/types";

// Global app chrome wrapper, rendered once from the root layout. It owns the
// two persistent nav surfaces — the desktop rail (lg+) and the phone bottom tab
// bar (< sm) — so they live across the primary signed-in surfaces instead of
// per-route. `children` (incl. the top NavBar) render inside the rail-padded
// column.
//
// `showShell` (signed-in viewer on a primary app route) gates the rail + the
// content offset. The rail sits on the RIGHT, so content gets lg:pr-56 (only at
// lg+). On /c/[slug], /login, the marketing home, etc. there's no rail and no
// offset; below lg the rail is `hidden`, so mobile/tablet UX is fully preserved.
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
      <div className={showShell ? "lg:pr-56" : undefined}>{children}</div>
      {showShell && user && <DesktopRail user={user} />}
      <MobileTabBar user={user} />
    </>
  );
}
