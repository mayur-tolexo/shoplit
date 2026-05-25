"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";
import { DownloadStoryButton } from "@/components/download-story-button";

// The dashboard hero: a warm-gradient banner with a greeting, the creator's
// public profile link (copy + share), and — on lg+ — a live preview of that
// profile inside the reused PhoneFrame. Below lg the phone is hidden in favour
// of a compact "View my profile" link so the hero stacks cleanly on mobile.
export function DashboardHero({ user }: { user: User }) {
  const [copied, setCopied] = useState(false);

  const firstName = user.displayName.split(" ")[0] || "creator";
  const handle = user.handle?.trim() ?? "";
  const profilePath = handle ? `/u/${handle}` : "";

  // Absolute URL for copy/share; only resolvable in the browser. We render the
  // path-only fallback during SSR so markup matches before hydration.
  const profileUrl =
    typeof window !== "undefined" && profilePath
      ? `${window.location.origin}${profilePath}`
      : profilePath;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Profile link copied", { description: profileUrl });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  };

  const handleShare = async () => {
    // Prefer the native share sheet (mobile); fall back to copy on desktop.
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({
          title: `${user.displayName} on shoplit`,
          text: "Check out my shoplit",
          url: profileUrl,
        });
        return;
      } catch {
        /* user cancelled or share failed → fall through to copy */
      }
    }
    await handleCopy();
  };

  return (
    <div className="relative mb-10 overflow-hidden rounded-3xl border border-rule">
      {/* Warm accent gradient wash — stays within the brand palette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%), linear-gradient(135deg, var(--paper), var(--cream))",
        }}
      />

      <div className="relative grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:p-10">
        {/* LEFT — greeting + profile link */}
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-4">
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                width={56}
                height={56}
                alt={user.displayName}
                unoptimized
                className="size-12 shrink-0 rounded-full border border-rule sm:size-14"
              />
            )}
            <div className="min-w-0">
              <p className="mb-0.5 text-sm text-muted">Welcome back</p>
              <h1 className="font-serif text-3xl leading-none tracking-tight sm:text-4xl">
                Hi {firstName}
              </h1>
            </div>
          </div>

          {handle ? (
            <>
              <p className="mb-3 max-w-md leading-relaxed text-muted">
                Your storefront is live. Share your link — followers tap, you get
                the click.
              </p>

              {/* Profile link + actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={profilePath}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-rule bg-cream/70 px-4 font-mono text-sm backdrop-blur-sm transition-colors hover:border-ink"
                >
                  <span className="truncate">/u/{handle}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy profile link"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-cream transition-opacity hover:opacity-90"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share profile link"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-medium transition-colors hover:bg-paper"
                >
                  <Share2 size={16} /> Share
                </button>
                <DownloadStoryButton
                  href={`/u/${handle}/story`}
                  label="Share to story"
                />
              </div>

              <p className="mt-2 text-xs text-muted">
                The story card is perfect for Instagram / TikTok stories.
              </p>

              {/* Mobile-only: phone preview is hidden below lg, so offer a link. */}
              <Link
                href={profilePath}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline lg:hidden"
              >
                View my profile <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <p className="max-w-md leading-relaxed text-muted">
              Finish setting up your profile to get a shareable link.
            </p>
          )}
        </div>

        {/* RIGHT — live preview (lg+ only) */}
        {handle && (
          <div className="hidden lg:block" style={{ width: 260 }}>
            <LivePreview profilePath={profilePath} title={user.displayName} />
          </div>
        )}
      </div>
    </div>
  );
}

// The PhoneFrame wraps a lazily-loaded iframe of the public profile. The page
// is wider than the frame, so we render the iframe at a larger logical width
// and CSS-scale it down to fit — giving a faithful, legible "as followers see
// it" preview without a screenshot service.
function LivePreview({ profilePath, title }: { profilePath: string; title: string }) {
  // Logical iframe size (a typical mobile viewport) scaled to fit the frame's
  // inner width. PhoneFrame is 9:19, max 380px; at 260px the inner content is
  // ~244px wide. We render the iframe at 390px and scale by ~0.625.
  const LOGICAL_W = 390;
  const FRAME_INNER_W = 244; // 260 - borders/insets, approx
  const scale = FRAME_INNER_W / LOGICAL_W;

  return (
    <div className="mx-auto" style={{ maxWidth: 260 }}>
      <div
        className="relative overflow-hidden rounded-[2.2rem] border-[7px] border-ink bg-ink shadow-2xl"
        style={{ aspectRatio: "9 / 19" }}
      >
        <div className="absolute left-1/2 top-1 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-ink" />
        <div className="absolute inset-1.5 overflow-hidden rounded-[1.8rem] bg-cream">
          <iframe
            src={profilePath}
            loading="lazy"
            title={`Live preview of ${title}'s profile`}
            tabIndex={-1}
            aria-hidden
            scrolling="no"
            className="origin-top-left border-0"
            style={{
              width: LOGICAL_W,
              height: LOGICAL_W * (19 / 9),
              transform: `scale(${scale})`,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
