import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PhoneFrame } from "@/components/phone-frame";

// Acquisition CTA shown at the bottom of every public cart page (`/c/{slug}`),
// after the products and before the footer. Converts viewers of a shared cart
// into shoplit signups. "Wow" treatment: a warm accent→ink gradient card with
// a glow and a tilted phone showing a miniature shoplit, so the viewer SEES
// what they'd get. On-brand (picks up the cart's per-page --accent). The phone
// is desktop-only (lg+); mobile/tablet get the copy + CTA on the gradient.
export function CreateYourOwnBanner() {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-ink text-cream">
        {/* Warm accent gradient wash + two glows for depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 55%, transparent) 0%, transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "var(--accent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent)" }}
        />

        <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_minmax(0,1fr)]">
          {/* Copy + CTAs */}
          <div className="flex flex-col items-start text-left">
            <div className="mb-5 flex items-center gap-2">
              <LogoMark className="h-9 w-9 shrink-0" />
              <span className="font-serif text-2xl leading-none tracking-tight text-cream">
                shoplit
              </span>
            </div>

            <h2 className="mb-4 max-w-xl font-serif text-4xl leading-[1.04] text-cream sm:text-5xl">
              Love this? Build your own shoplit.
            </h2>

            <p className="mb-7 max-w-md text-sm leading-relaxed text-cream/80 sm:text-base">
              Turn the products you love into one beautiful, shareable link —
              free. Your followers tap, you get the click.
            </p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-cream px-7 text-sm font-semibold text-ink shadow-lg shadow-black/25 transition-transform hover:scale-[1.03]"
              >
                Create your shoplit — free
                <ArrowRight
                  size={16}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/discover"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full px-5 text-sm font-medium text-cream/80 underline-offset-4 transition-colors hover:text-cream hover:underline"
              >
                Discover creators
              </Link>
            </div>
          </div>

          {/* Tilted phone preview — desktop only. Peeks past the card edge for a
              dynamic feel (the card clips it via overflow-hidden). */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="mx-auto w-[230px] translate-y-6 rotate-[7deg] drop-shadow-2xl">
              <PhoneFrame>
                <MiniShoplit />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// A static, data-free miniature of a shoplit cart page (cover + creator handle
// + a little product grid) shown inside the phone frame. Purely decorative.
function MiniShoplit() {
  return (
    <div className="text-ink">
      <div className="relative h-28 bg-gradient-to-br from-accent to-ink">
        <div className="absolute inset-x-3 bottom-2">
          <div className="mb-1 flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full border border-cream/50 bg-cream/80" />
            <span className="text-[10px] font-medium text-cream/90">@you</span>
          </div>
          <p className="font-serif text-sm leading-tight text-cream">My Edit</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-md border border-rule bg-paper"
          >
            <div className="aspect-square bg-gradient-to-br from-paper to-rule" />
            <div className="space-y-1 p-1.5">
              <div className="h-1.5 w-3/4 rounded bg-rule" />
              <div className="h-1.5 w-1/3 rounded bg-accent/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
