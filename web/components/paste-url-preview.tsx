"use client";

import { useState, useTransition } from "react";
import { Loader2, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fetchOG, uploadImage } from "@/lib/api-client";
import { parseShare } from "@/lib/parse-share";
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
  // What the creator pasted (kept intact so large "share text" stays visible).
  const [rawInput, setRawInput] = useState("");
  // The clean product URL extracted from it (editable in the resolved form).
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
  const [uploading, setUploading] = useState(false);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage(file));
    } catch {
      toast.error("Couldn't upload that photo — try a smaller image.");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setRawInput("");
    setUrl("");
    setShowForm(false);
    setAutofilled(false);
    setTitle("");
    setImageUrl("");
    setPriceText("");
    setNote("");
    setRetailer("other");
  };

  const handlePaste = (raw: string) => {
    setRawInput(raw);
    // Accept full retailer "share text", not just a bare URL — parseShare pulls
    // out a clean http(s) link (upgrading scheme-less ones, trimming trailing
    // punctuation) plus a best-effort title and price.
    const parsed = parseShare({ text: raw, url: raw });
    if (!parsed.productUrl) {
      setUrl("");
      setShowForm(false);
      return;
    }
    setUrl(parsed.productUrl);

    startTransition(async () => {
      try {
        const og = await fetchOG(parsed.productUrl);
        setRetailer(og.retailer);
        // Show the resolved canonical link (short links expand) so the visible
        // "Product link" field is exactly what gets stored — never a surprise.
        if (og.canonicalUrl) setUrl(og.canonicalUrl);
        // Prefer the clean title from the share text; fall back to OG. This
        // gives a usable title even when the server fetch is blocked.
        setTitle(parsed.title || og.title || "");
        if (og.ok) {
          setImageUrl(og.imageUrl ?? "");
          setPriceText(og.priceText || parsed.priceText || "");
        } else {
          setPriceText(parsed.priceText || "");
        }
        setAutofilled(Boolean(parsed.title || (og.ok && (og.title || og.imageUrl))));
      } catch {
        setTitle(parsed.title);
        setPriceText(parsed.priceText || "");
        setAutofilled(Boolean(parsed.title));
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
      // Store exactly the link shown in the editable field above.
      originalUrl: url.trim(),
      note: note.trim(),
    });
    reset();
  };

  return (
    <section className="rounded-xl border-2 border-rule bg-paper p-5 space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-2">Paste a product link — or the whole &ldquo;share&rdquo; text from a shopping app</span>
        <div className="relative">
          <Link2 size={16} className="absolute left-3 top-4 text-muted" aria-hidden />
          <textarea
            rows={2}
            value={rawInput}
            onChange={(e) => handlePaste(e.target.value)}
            onPaste={(e) => {
              // iOS Safari doesn't reliably fire onChange for a long-press
              // paste — capture the clipboard data directly.
              e.preventDefault();
              handlePaste(e.clipboardData.getData("text"));
            }}
            placeholder="Paste here — e.g. “Check out this product… https://www.myntra.com/…”"
            className="w-full resize-y rounded-lg border border-rule bg-cream py-3 pl-10 pr-4 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
        {url && (
          <p className="mt-1 text-xs text-muted truncate">
            Link detected: <span className="text-ink">{url}</span>
          </p>
        )}
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
                <label className="shrink-0 inline-flex items-center rounded-md border border-rule bg-cream px-3 py-2 text-sm font-medium cursor-pointer hover:bg-paper whitespace-nowrap">
                  {uploading ? "…" : "📷"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onPickPhoto} />
                </label>
              </div>
            </div>
          </div>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Product link"
            className="w-full rounded-md border border-rule bg-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />

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
