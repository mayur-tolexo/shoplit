import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/logo";

// Acquisition CTA shown at the bottom of every public cart page (`/c/{slug}`),
// after the products and before the footer. Converts viewers of a shared cart
// into shoplit signups. On-brand: dark ink card with cream text and an accent
// glow that picks up the cart's per-page --accent (set inline on the page
// wrapper). Stacks cleanly at 360px; all tap targets are >=44px.
export function CreateYourOwnBanner() {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl bg-ink text-cream px-6 py-10 sm:px-12 sm:py-14">
        {/* Soft accent glow so the card feels tied to this creator's cart. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--accent)" }}
        />
        <div className="relative flex flex-col items-start gap-5 text-left">
          {/* Wordmark: standalone mark (accent fill) + serif name in cream. */}
          <div className="flex items-center gap-2">
            <LogoMark className="h-9 w-9 shrink-0" />
            <span className="font-serif text-2xl leading-none tracking-tight text-cream">
              shoplit
            </span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl leading-[1.05] text-cream max-w-xl">
            Love this? Build your own shoplit.
          </h2>

          <p className="text-sm sm:text-base text-cream/75 max-w-md leading-relaxed">
            Turn the products you love into one beautiful, shareable link — free.
          </p>

          <div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center w-full sm:w-auto">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-cream px-6 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              Create your shoplit — free
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/discover"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-medium text-cream/80 transition-colors hover:text-cream"
            >
              Discover creators
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
