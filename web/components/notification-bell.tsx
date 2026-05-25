"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markNotificationsSeen,
} from "@/lib/api-client";
import { relativeTime } from "@/lib/relative-time";
import type { NotificationItem } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// In-app new-cart notifications. A Bell button (>=44px tap target) carries an
// unread badge fed by getUnreadCount() on mount. Opening the dropdown loads the
// list (getNotifications) AND marks everything seen (markNotificationsSeen),
// optimistically zeroing the badge so it doesn't reappear. Every step is
// best-effort: a failed fetch leaves the bell usable (no crash, empty list).
//
// Rendered only when a user is present (the NavBar gates it), so we never show
// a logged-out bell. State refreshes on page load — no live polling (per spec).
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Badge on mount. getUnreadCount() returns 0 on error, so this is safe.
  useEffect(() => {
    let active = true;
    getUnreadCount().then((c) => {
      if (active) setCount(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    // Optimistically clear the badge the moment the menu opens.
    setCount(0);
    // Fire-and-forget the seen marker; ignore failures (badge already cleared).
    markNotificationsSeen().catch(() => {});
    // Populate the list. A failure leaves the previous list (or empty) intact.
    getNotifications()
      .then((res) => {
        setItems(res.items);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  };

  const goTo = (slug: string) => {
    // Close the menu explicitly — plain buttons inside the content don't
    // auto-dismiss the way a DropdownMenuItem would.
    setOpen(false);
    router.push(`/c/${slug}`);
  };

  const badge = count > 99 ? "99+" : String(count);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : "Notifications"
          }
          className="relative flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-ink outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Bell size={22} aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-none text-cream tabular-nums"
            >
              {badge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="border-b border-rule px-3 py-2.5">
          <p className="font-serif text-base leading-tight text-ink">
            Notifications
          </p>
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {loaded
                ? "No new carts yet — follow more creators."
                : "Loading…"}
            </p>
          ) : (
            <ul className="py-1">
              {items.map((n) => (
                <li key={`${n.cartSlug}-${n.createdAt}`}>
                  <button
                    type="button"
                    onClick={() => goTo(n.cartSlug)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper focus-visible:bg-paper outline-none ${
                      n.unread ? "bg-paper/60" : ""
                    }`}
                  >
                    <span className="relative shrink-0">
                      {n.creatorAvatarUrl ? (
                        <Image
                          src={n.creatorAvatarUrl}
                          width={36}
                          height={36}
                          alt={n.creatorDisplayName || n.creatorHandle}
                          className="h-9 w-9 rounded-full border border-rule object-cover"
                          unoptimized
                        />
                      ) : (
                        // Backend marshals a null avatar to "" — render an
                        // initial-based placeholder rather than crashing
                        // next/image on an empty src.
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper text-sm font-medium uppercase text-muted">
                          {(n.creatorDisplayName || n.creatorHandle || "?").charAt(0)}
                        </span>
                      )}
                      {n.unread && (
                        <span
                          aria-hidden
                          className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-cream"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">
                        <span className="font-medium">@{n.creatorHandle}</span>{" "}
                        shared a new cart
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {n.cartTitle}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
