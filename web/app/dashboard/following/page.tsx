import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Compass, Rss } from "lucide-react";
import type { Cart } from "@/lib/types";
import { getFollowingFeed } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";

export const dynamic = "force-dynamic";

export default async function FollowingFeedPage() {
  // Forward cookies so the authed feed resolves the right viewer. An auth
  // failure → /login (the layout also guards, this is the page-level guard).
  const cookie = cookies().toString();
  let carts: Cart[];
  try {
    carts = await getFollowingFeed({ cookie });
  } catch {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-24 sm:pb-10">
      <div className="flex items-center gap-3 mb-8">
        <span
          className="grid place-items-center size-11 rounded-xl text-accent shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Rss size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-none">Following</h1>
          <p className="text-sm text-muted mt-1">Newest carts from creators you follow.</p>
        </div>
      </div>

      {carts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {carts.map((c) => (
            <CartCard key={c.id} cart={c} showStats={false} showOwner href={`/c/${c.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-rule bg-paper p-6 sm:p-10 text-center">
      <span
        className="mx-auto grid place-items-center size-12 rounded-full text-accent mb-4"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        <Compass size={24} />
      </span>
      <h2 className="font-serif text-2xl sm:text-3xl mb-2">Your feed is waiting</h2>
      <p className="text-muted leading-relaxed max-w-md mx-auto mb-6">
        Follow a few creators and their newest carts will land right here. Go find some taste you
        trust.
      </p>
      <Link
        href="/discover"
        className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
      >
        <Compass size={16} /> Discover creators
      </Link>
    </div>
  );
}
