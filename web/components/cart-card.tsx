"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2 } from "lucide-react";
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
        {showCopy && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy link to ${cart.title}`}
            className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-ink/85 text-cream px-3 py-1.5 text-xs font-medium backdrop-blur opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-ink"
          >
            {copied ? <Check size={12} /> : <Link2 size={12} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-serif text-xl mb-1 line-clamp-2">{cart.title}</h3>
        <p className="text-sm text-muted">
          {cart.products.length} {cart.products.length === 1 ? "product" : "products"}
          {" · "}{cart.viewsLast7d.toLocaleString()} views (7d)
          {" · "}{cart.clicksLast7d.toLocaleString()} clicks (7d)
        </p>
      </div>
    </Link>
  );
}
