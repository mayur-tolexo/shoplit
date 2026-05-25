"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { DownloadStoryButton } from "@/components/download-story-button";

interface StickyShareBarProps {
  slug: string;
  cartTitle: string;
  ownerHandle: string;
}

// Floating pill that sits at the bottom of the public cart page on all
// viewports. Lets a viewer copy or share the link without scrolling to the
// footer. Native Web Share when available; clipboard copy fallback.
export function StickyShareBar({ slug, cartTitle, ownerHandle }: StickyShareBarProps) {
  const [copied, setCopied] = useState(false);

  const buildShareURL = () => {
    if (typeof window === "undefined") return `/c/${slug}`;
    return `${window.location.origin}/c/${slug}`;
  };

  const handleShare = async () => {
    const url = buildShareURL();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${cartTitle} · shoplit`,
          text: `Check out @${ownerHandle}'s picks on shoplit`,
          url,
        });
        return;
      } catch {
        // User cancelled or share rejected — fall through to copy.
      }
    }
    await handleCopy();
  };

  const handleCopy = async () => {
    const url = buildShareURL();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  };

  return (
    <div
      aria-label="Share this cart"
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none flex justify-center px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink/95 text-cream backdrop-blur px-3 py-2 shadow-2xl border border-ink/80 max-w-md w-full sm:w-auto">
        <span className="text-xs text-cream/80 px-2 hidden sm:inline">Love this cart?</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link"
          className="flex items-center gap-1.5 rounded-full bg-cream/10 hover:bg-cream/15 transition-colors px-3 py-1.5 text-sm flex-1 sm:flex-none justify-center"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
        <DownloadStoryButton
          href={`/c/${slug}/story`}
          label="Story"
          className="min-h-0 flex-1 border-cream/20 bg-cream/10 px-3 py-1.5 text-cream hover:bg-cream/15 focus-visible:ring-offset-ink sm:flex-none"
        />
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full bg-cream text-ink hover:opacity-90 transition-opacity px-4 py-1.5 text-sm font-medium flex-1 sm:flex-none justify-center"
        >
          <Share2 size={14} />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
