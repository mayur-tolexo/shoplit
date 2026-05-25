"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, MousePointerClick, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Cart } from "@/lib/types";
import { CartCover } from "@/components/cart-cover";

interface CartCardProps {
  cart: Cart;
  href?: string;
  /** When true, show a copy-share button overlaid on the cover. Defaults true on dashboard usage. */
  showCopy?: boolean;
}

export function CartCard({ cart, href, showCopy = true }: CartCardProps) {
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
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg mb-2 line-clamp-2">{cart.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye size={13} /> {cart.viewsLast7d.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MousePointerClick size={13} /> {cart.clicksLast7d.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={13} /> {cart.reachLast7d.toLocaleString()}
            </span>
            <span className="text-muted/70">
              · {cart.products.length} {cart.products.length === 1 ? "item" : "items"}
            </span>
          </div>
          {showCopy && (
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
