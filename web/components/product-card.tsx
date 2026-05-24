"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Product } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface ProductCardProps {
  product: Product;
  eagerImage?: boolean;
}

export function ProductCard({ product, eagerImage = false }: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = imgFailed ? "/placeholder-product.svg" : product.imageUrl;

  // Shop via the redirect service so the click is logged and the affiliate
  // tag is applied. /go/{slug} is rewritten to shoplit-redirect (see
  // next.config.mjs). Fall back to the raw URL if a slug is somehow missing.
  const shopHref = product.goSlug ? `/go/${product.goSlug}` : product.originalUrl;

  return (
    <article className="group rounded-xl overflow-hidden border border-rule bg-cream transition-shadow hover:shadow-md">
      <a
        href={shopHref}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`Shop ${product.title} on ${retailerLabel(product.retailer)}`}
      >
        <div className="relative aspect-square bg-paper">
          <Image
            src={imgSrc}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={eagerImage}
            loading={eagerImage ? "eager" : "lazy"}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        </div>
      </a>
      <div className="p-5 sm:p-6">
        <h3 className="font-serif text-xl leading-tight mb-1">{product.title}</h3>
        {product.note && (
          <p className="italic text-sm text-muted mb-2 leading-relaxed">&ldquo;{product.note}&rdquo;</p>
        )}
        {product.priceText && <p className="text-sm text-muted mb-4">{product.priceText}</p>}
        <a
          href={shopHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent text-cream font-medium py-3 px-4 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-cream"
        >
          <RetailerIcon retailer={product.retailer} size={16} />
          Shop on {retailerLabel(product.retailer)}
          <ExternalLink size={14} aria-hidden />
        </a>
      </div>
    </article>
  );
}
