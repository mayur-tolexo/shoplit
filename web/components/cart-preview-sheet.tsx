import Image from "next/image";
import { CartCover } from "@/components/cart-cover";
import { ProductCard } from "@/components/product-card";
import type { Cart } from "@/lib/types";

// A faithful, self-contained preview of how a cart looks on its public page.
// `fullPage` makes the hero taller for the full-screen mobile sheet; the
// default compact hero suits the desktop side panel / phone frame.
export function CartPreviewSheet({ cart, fullPage = false }: { cart: Cart; fullPage?: boolean }) {
  return (
    <div
      style={{ ["--accent" as string]: cart.accentHex } as React.CSSProperties}
      className="bg-cream"
    >
      {/* HERO */}
      <section className={`relative w-full ${fullPage ? "h-[40vh] min-h-[240px]" : "aspect-[5/4]"}`}>
        <CartCover coverImageUrl={cart.coverImageUrl} accentHex={cart.accentHex} title={cart.title} />
        <div className="absolute inset-0 bg-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-cream [text-shadow:0_1px_10px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-2 mb-1.5">
            <Image
              src={cart.ownerAvatarUrl}
              alt=""
              width={24}
              height={24}
              className="rounded-full border border-cream/40"
              unoptimized
            />
            <span className="text-xs font-medium">@{cart.ownerHandle}</span>
          </div>
          <h1 className="font-serif text-2xl leading-tight">{cart.title}</h1>
          {cart.bio && <p className="text-xs text-cream/95 mt-1 line-clamp-2">{cart.bio}</p>}
        </div>
      </section>

      {/* PRODUCTS */}
      <div className="p-4">
        {cart.products.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No products yet — add one to see it here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 pointer-events-none">
            {cart.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
