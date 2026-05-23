import Link from "next/link";
import Image from "next/image";
import type { Cart } from "@/lib/types";

interface CartCardProps {
  cart: Cart;
  href?: string;
}

export function CartCard({ cart, href }: CartCardProps) {
  const target = href ?? `/dashboard/carts/${cart.id}`;
  return (
    <Link
      href={target}
      className="block group rounded-xl overflow-hidden border border-rule bg-cream transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] bg-paper">
        <Image
          src={cart.coverImageUrl}
          alt={cart.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized
        />
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
