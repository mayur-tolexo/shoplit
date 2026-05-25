"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Eye, Lock, MousePointerClick, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Cart } from "@/lib/types";
import { CartCover } from "@/components/cart-cover";

interface CartCardProps {
  cart: Cart;
  href?: string;
  /** When true, show a copy-share button overlaid on the cover. Defaults true on dashboard usage. */
  showCopy?: boolean;
  /**
   * When true (default) show the 7-day views/clicks/reach row, the Share
   * button and the "Private" badge — owner/dashboard contexts. Set false in
   * public contexts (profiles, following feed) where those numbers are 0 and
   * leaking another creator's analytics is undesirable.
   */
  showStats?: boolean;
  /** When true, render the cart owner (avatar + @handle). Used in the feed. */
  showOwner?: boolean;
}

export function CartCard({
  cart,
  href,
  showCopy = true,
  showStats = true,
  showOwner = false,
}: CartCardProps) {
  const target = href ?? `/dashboard/carts/${cart.id}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/c/${cart.slug}`
        : `/c/${cart.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Open the cart to share manually.");
    }
  };

  return (
    <Link
      href={target}
      className="block group rounded-xl overflow-hidden border border-rule bg-cream transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] bg-paper">
        <CartCover
          coverImageUrl={cart.coverImageUrl}
          accentHex={cart.accentHex}
          title={cart.title}
          alt={cart.title}
          sizes="(max-width: 768px) 100vw, 33vw"
          imageClassName="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {showStats && cart.visibility === "private" && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/85 text-cream px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            <Lock size={11} aria-hidden /> Private
          </span>
        )}
      </div>
      <div className="p-4">
        {showOwner && (
          <div className="flex items-center gap-2 mb-2">
            {cart.ownerAvatarUrl && (
              <Image
                src={cart.ownerAvatarUrl}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="rounded-full border border-rule shrink-0"
              />
            )}
            <span className="text-xs text-muted truncate">@{cart.ownerHandle}</span>
          </div>
        )}
        <h3 className="font-serif text-lg mb-2 line-clamp-2">{cart.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {showStats && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Eye size={13} /> {cart.viewsLast7d.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick size={13} /> {cart.clicksLast7d.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={13} /> {cart.reachLast7d.toLocaleString()}
                </span>
              </>
            )}
            <span className={showStats ? "text-muted/70" : ""}>
              {showStats ? "· " : ""}
              {cart.products.length} {cart.products.length === 1 ? "item" : "items"}
            </span>
          </div>
          {showStats && showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy link to ${cart.title}`}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-xs font-medium hover:border-ink hover:bg-paper transition-colors"
            >
              {copied ? <Check size={13} /> : <Share2 size={13} />}
              {copied ? "Copied" : "Share"}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
