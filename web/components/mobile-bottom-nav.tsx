"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api-client";

// Sticky bottom nav for /dashboard* on mobile only. Hidden at sm+ (the top
// NavBar covers desktop). 3 actions: home / add a product (prominent) / sign out.
export function MobileBottomNav() {
  const pathname = usePathname();
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

  const isHome = pathname === "/dashboard";

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-rule bg-cream/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-16 px-2">
        <NavItem href="/dashboard" label="Carts" icon={<Home size={20} />} active={isHome} />
        <CenterAction href="/add" />
        <NavButton label="Sign out" icon={<LogOut size={20} />} onClick={handleLogout} />
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
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      <span className="text-[11px] leading-none">{label}</span>
    </Link>
  );
}

function NavButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted hover:text-ink transition-colors"
    >
      {icon}
      <span className="text-[11px] leading-none">{label}</span>
    </button>
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
