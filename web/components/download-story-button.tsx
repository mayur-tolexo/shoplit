"use client";

import { ImageDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DownloadStoryButtonProps {
  // Absolute or relative URL of the story PNG route (e.g. `/c/{slug}/story`).
  href: string;
  // Action label. Defaults to "Story card".
  label?: string;
  // Extra classes to tune layout per surface (full-width row, pill, etc).
  className?: string;
}

// A plain download link styled as a tasteful pill/row. It points at the
// server-rendered 9:16 story PNG (an `attachment` download), so it works even
// with JavaScript disabled — the toast is pure enhancement. ≥44px tap target.
export function DownloadStoryButton({
  href,
  label = "Story card",
  className,
}: DownloadStoryButtonProps) {
  return (
    <a
      href={href}
      download
      onClick={() =>
        toast.success("Saved — post it to your story ✨", {
          description: "Perfect for Instagram / TikTok stories.",
        })
      }
      className={cn(
        "group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full",
        "border border-ink bg-cream px-4 text-sm font-medium text-ink",
        "transition-colors hover:bg-paper focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        className
      )}
    >
      <ImageDown size={16} className="shrink-0 text-accent" aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  );
}
