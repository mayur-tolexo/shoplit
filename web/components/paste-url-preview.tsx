"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Link2 } from "lucide-react";
import { fetchOG } from "@/lib/api-client";
import type { OGResult, Product } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface PasteUrlPreviewProps {
  onResolved: (draft: Omit<Product, "id">) => void;
}

export function PasteUrlPreview({ onResolved }: PasteUrlPreviewProps) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<OGResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePaste = (newUrl: string) => {
    setUrl(newUrl);
    setError(null);
    setPreview(null);
    if (!newUrl.match(/^https?:\/\/.+/)) return;
    startTransition(async () => {
      try {
        const og = await fetchOG(newUrl);
        setPreview(og);
        if (!og.ok) setError(og.reason ?? "Couldn't fetch product details.");
      } catch {
        setError("Something went wrong. Please add the product manually.");
      }
    });
  };

  const handleAdd = () => {
    if (!preview || !preview.ok) return;
    onResolved({
      title: preview.title!,
      imageUrl: preview.imageUrl!,
      priceText: preview.priceText ?? "",
      retailer: preview.retailer,
      originalUrl: url,
      note: "",
    });
    setUrl("");
    setPreview(null);
  };

  return (
    <section className="rounded-xl border-2 border-rule bg-paper p-5 space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-2">Paste a product URL to add it instantly</span>
        <div className="relative">
          <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="url"
            value={url}
            onChange={(e) => handlePaste(e.target.value)}
            placeholder="https://www.myntra.com/example-kurta"
            className="w-full rounded-lg border border-rule bg-cream py-4 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
      </label>

      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Fetching product details…
        </div>
      )}

      {preview && preview.ok && (
        <div className="flex gap-4 p-4 rounded-lg border border-rule bg-paper">
          {preview.imageUrl && (
            <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden bg-cream">
              <Image src={preview.imageUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{preview.title}</p>
            <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
              <RetailerIcon retailer={preview.retailer} size={12} />
              {retailerLabel(preview.retailer)} · {preview.priceText ?? "no price"}
            </p>
            <button
              type="button"
              onClick={handleAdd}
              className="mt-2 rounded-full bg-ink text-cream px-3 py-1 text-xs font-medium hover:opacity-90"
            >
              Add to cart
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-muted" role="status">{error}</p>
      )}
    </section>
  );
}
