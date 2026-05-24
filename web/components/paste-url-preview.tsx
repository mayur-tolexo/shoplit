"use client";

import { useState, useTransition } from "react";
import { Loader2, Link2, Plus } from "lucide-react";
import { fetchOG } from "@/lib/api-client";
import type { Product, Retailer } from "@/lib/types";
import { RetailerIcon, retailerLabel } from "./retailer-icon";

interface PasteUrlPreviewProps {
  onResolved: (draft: Omit<Product, "id">) => void;
}

// Paste a URL → server fetches OG tags → an EDITABLE draft form appears,
// pre-filled with whatever we could fetch. If the site blocks the fetch
// (some retailers do), the fields are blank and the creator fills them in
// manually — so adding a product never dead-ends.
export function PasteUrlPreview({ onResolved }: PasteUrlPreviewProps) {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [autofilled, setAutofilled] = useState(false);

  // editable draft
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [note, setNote] = useState("");
  const [retailer, setRetailer] = useState<Retailer>("other");

  const reset = () => {
    setUrl("");
    setShowForm(false);
    setAutofilled(false);
    setTitle("");
    setImageUrl("");
    setPriceText("");
    setNote("");
    setRetailer("other");
  };

  const handlePaste = (newUrl: string) => {
    setUrl(newUrl);
    if (!newUrl.match(/^https?:\/\/.+/)) {
      setShowForm(false);
      return;
    }
    startTransition(async () => {
      try {
        const og = await fetchOG(newUrl);
        setRetailer(og.retailer);
        if (og.ok) {
          setTitle(og.title ?? "");
          setImageUrl(og.imageUrl ?? "");
          setPriceText(og.priceText ?? "");
          setAutofilled(true);
        } else {
          setAutofilled(false);
        }
      } catch {
        setAutofilled(false);
      } finally {
        setShowForm(true);
      }
    });
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    onResolved({
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      priceText: priceText.trim(),
      retailer,
      originalUrl: url,
      note: note.trim(),
    });
    reset();
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
            placeholder="https://www.myntra.com/…"
            className="w-full rounded-lg border border-rule bg-cream py-4 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
      </label>

      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Fetching product details…
        </div>
      )}

      {showForm && !pending && (
        <div className="rounded-lg border border-rule bg-cream p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-muted flex items-center gap-1.5">
              <RetailerIcon retailer={retailer} size={12} />
              {retailerLabel(retailer)}
            </span>
            {autofilled ? (
              <span className="text-xs text-accent">Auto-filled — edit anything</span>
            ) : (
              <span className="text-xs text-muted">Couldn&apos;t auto-fill — add details below</span>
            )}
          </div>

          <div className="flex gap-3">
            <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden bg-paper border border-rule">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted text-center px-1">
                  no image
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product title (required)"
                className="w-full rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder="₹ price"
                  className="w-28 rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Image URL"
                  className="flex-1 rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your note about this product (optional)"
            className="w-full rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              <Plus size={14} /> Add to cart
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-muted hover:text-ink px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
