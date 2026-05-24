"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api-client";
import { Logo } from "@/components/logo";
import type { User } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
export function NavBar({ variant = "marketing", user }: NavBarProps) {
  const router = useRouter();

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
    <nav className="border-b border-rule bg-cream/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
        <Logo href={variant === "app" ? "/dashboard" : "/"} />
        {variant === "marketing" && (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-ink text-cream px-4 py-2 font-medium hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        )}
        {variant === "app" && user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
              <Image
                src={user.avatarUrl}
                width={32}
                height={32}
                alt={user.displayName}
                className="rounded-full border border-rule"
                unoptimized
              />
              <span className="text-sm">@{user.handle}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
