import Link from "next/link";
import { Eye, MousePointerClick, Star } from "lucide-react";
import type { Cart } from "@/lib/types";
import { CartCover } from "@/components/cart-cover";

// The featured "Top cart" — the caller passes the cart with the highest
// viewsLast7d. It's a larger, landscape hero card linking into the cart editor.
// Renders nothing when there's no cart or the top cart has no 7-day views
// (nothing to celebrate yet), so the dashboard stays quiet for new creators.
export function TopCartCard({ cart }: { cart: Cart | null }) {
  if (!cart || (cart.viewsLast7d || 0) <= 0) return null;

  return (
    <Link
      href={`/dashboard/carts/${cart.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-rule bg-cream transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-paper">
        <CartCover
          coverImageUrl={cart.coverImageUrl}
          accentHex={cart.accentHex}
          title={cart.title}
          alt={cart.title}
          sizes="(max-width: 1024px) 100vw, 40vw"
          imageClassName="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-medium text-cream backdrop-blur-sm">
          <Star size={12} className="fill-current" aria-hidden /> Top cart
        </span>
      </div>
      <div className="p-5">
        <h3 className="mb-2 line-clamp-1 font-serif text-2xl">{cart.title}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Eye size={15} /> {cart.viewsLast7d.toLocaleString()}
            <span className="text-muted/70">views · 7d</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MousePointerClick size={15} /> {cart.clicksLast7d.toLocaleString()}
            <span className="text-muted/70">clicks · 7d</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
