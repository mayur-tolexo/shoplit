import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { Cart } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";

// One "new cart" entry in the Your-feed activity stream. Presentational and
// dependency-light, so it stays a server component (no "use client"). The card
// is intentionally NOT a single big <Link>: the creator and the cart are
// distinct destinations, so each gets its own discrete link/tap target.
//
// Mobile-web: the thumbnail row is four 64px squares + 8px gaps = 280px, which
// fits inside a 360px viewport with the card's px-4 (32px) padding. Tap targets
// (creator link, View-cart CTA) are ≥44px tall.

const MAX_THUMBS = 4;

export function FeedItem({ cart }: { cart: Cart }) {
  const cartHref = `/c/${cart.slug}`;
  const productCount = cart.products.length;
  const thumbs = cart.products.slice(0, MAX_THUMBS);
  const overflow = productCount - thumbs.length;

  return (
    <article className="rounded-2xl border border-rule bg-cream p-4 transition-shadow hover:shadow-md">
      <header className="flex items-center gap-2 text-sm">
        <Link
          href={`/u/${cart.ownerHandle}`}
          className="inline-flex min-h-[44px] items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {cart.ownerAvatarUrl ? (
            <Image
              src={cart.ownerAvatarUrl}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="size-8 rounded-full border border-rule object-cover shrink-0"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full border border-rule bg-paper text-xs font-medium text-muted shrink-0">
              {(cart.ownerDisplayName.trim()[0] ?? "?").toUpperCase()}
            </span>
          )}
          <span className="font-medium">@{cart.ownerHandle}</span>
        </Link>
        <span className="text-muted/70" aria-hidden>
          ·
        </span>
        <time dateTime={cart.createdAt} className="text-muted shrink-0">
          {relativeTime(cart.createdAt)}
        </time>
      </header>

      <p className="mt-2 text-sm text-muted">shared a new cart</p>

      <h3 className="mt-0.5 font-serif text-xl leading-snug tracking-tight">
        <Link href={cartHref} className="hover:underline underline-offset-2">
          {cart.title}
        </Link>
      </h3>

      {productCount > 0 && (
        <div className="mt-3 flex items-center gap-2">
          {thumbs.map((p, i) => (
            <Link
              key={p.id}
              href={cartHref}
              aria-label={`View cart ${cart.title}`}
              className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-rule bg-paper"
            >
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt={p.title}
                  fill
                  unoptimized
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center font-serif text-base text-muted/60"
                >
                  {(p.title.trim()[0] ?? "•").toUpperCase()}
                </span>
              )}
              {/* +N overflow chip sits on the last visible thumbnail. */}
              {overflow > 0 && i === thumbs.length - 1 && (
                <span className="absolute inset-0 grid place-items-center bg-ink/55 text-sm font-medium text-cream backdrop-blur-[1px]">
                  +{overflow}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {productCount} {productCount === 1 ? "product" : "products"}
        </span>
        <Link
          href={cartHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-medium hover:text-accent transition-colors"
        >
          View cart <ArrowRight size={15} aria-hidden />
        </Link>
      </footer>
    </article>
  );
}
