import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/api-client";

export async function NavBar({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const user = variant === "app" ? await getCurrentUser() : null;
  return (
    <nav className="border-b border-rule bg-cream/90 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
        <Link href={variant === "app" ? "/dashboard" : "/"} className="font-serif text-2xl tracking-tight">
          shoplit
        </Link>
        {variant === "marketing" && (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-ink transition-colors">Sign in</Link>
            <Link
              href="/login"
              className="rounded-full bg-ink text-cream px-4 py-2 font-medium hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        )}
        {variant === "app" && user && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={user.avatarUrl}
              width={32}
              height={32}
              alt={user.displayName}
              className="rounded-full border border-rule"
              unoptimized
            />
            <span className="text-sm">@{user.handle}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
