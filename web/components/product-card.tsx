"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
}

// Compact, fully-clickable product tile built for a grid — scales cleanly
// from a few products to dozens. The whole card links through the redirect
// service (/go/{slug}) so clicks are logged and affiliate-tagged.
export function ProductCard({ product, eagerImage = false }: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = imgFailed ? "/placeholder-product.svg" : product.imageUrl;
  const shopHref = product.goSlug ? `/go/${product.goSlug}` : product.originalUrl;

  return (
    <a
      href={shopHref}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`Shop ${product.title} on ${retailerLabel(product.retailer)}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-rule bg-cream transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-square bg-paper">
        <Image
          src={imgSrc}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          priority={eagerImage}
          loading={eagerImage ? "eager" : "lazy"}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          unoptimized
          onError={() => setImgFailed(true)}
        />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-cream/90 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-ink">
          <RetailerIcon retailer={product.retailer} size={11} />
          {retailerLabel(product.retailer)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="font-serif text-sm sm:text-base leading-snug line-clamp-2 mb-1">{product.title}</h3>
        {product.note && (
          <p className="italic text-xs text-muted line-clamp-1 mb-1.5">&ldquo;{product.note}&rdquo;</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-ink">{product.priceText || " "}</span>
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent transition-all group-hover:gap-1.5">
            Shop <ArrowUpRight size={14} aria-hidden />
          </span>
        </div>
      </div>
    </a>
  );
}
