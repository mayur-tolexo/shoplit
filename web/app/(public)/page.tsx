import Link from "next/link";
import Image from "next/image";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { CartCard } from "@/components/cart-card";
import { listMyCarts } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const exampleCarts = (await listMyCarts()).slice(0, 3);
  return (
    <>
      <NavBar variant="marketing" />
      <main>
        {/* HERO */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-6">
                Free shoppable carts for creators.
              </h1>
              <p className="text-lg text-muted mb-8 max-w-xl leading-relaxed">
                Bundle products from Amazon, Myntra, Nykaa and more into one shareable link
                your followers will actually love opening.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
                >
                  Start free
                </Link>
                {exampleCarts[0] && (
                  <Link
                    href={`/c/${exampleCarts[0].slug}`}
                    className="text-ink underline-offset-4 hover:underline transition-all"
                  >
                    See an example →
                  </Link>
                )}
              </div>
            </div>
            {exampleCarts[0] && (
              <div className="relative aspect-[9/16] max-w-sm w-full justify-self-center rounded-3xl overflow-hidden border border-rule shadow-xl">
                <Image
                  src={exampleCarts[0].coverImageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 90vw, 40vw"
                  className="object-cover"
                  priority
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-cream">
                  <p className="font-serif text-3xl leading-tight">{exampleCarts[0].title}</p>
                  <p className="text-sm opacity-80 mt-1">@{exampleCarts[0].ownerHandle}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <h2 className="font-serif text-3xl mb-10 text-center">How it works</h2>
            <ol className="grid gap-8 sm:grid-cols-3">
              <li>
                <p className="font-serif text-2xl mb-2">1.</p>
                <h3 className="font-medium mb-2">Paste any product URL</h3>
                <p className="text-muted text-sm leading-relaxed">From Amazon, Myntra, Nykaa, Flipkart, AJIO — we auto-fill the title and image.</p>
              </li>
              <li>
                <p className="font-serif text-2xl mb-2">2.</p>
                <h3 className="font-medium mb-2">Customize your cart</h3>
                <p className="text-muted text-sm leading-relaxed">Pick a cover image and accent color. Add a short bio. Reorder products with a drag.</p>
              </li>
              <li>
                <p className="font-serif text-2xl mb-2">3.</p>
                <h3 className="font-medium mb-2">Share the link</h3>
                <p className="text-muted text-sm leading-relaxed">A short, beautiful URL your followers can open from Instagram, WhatsApp, or anywhere.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* EXAMPLE CARTS */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <h2 className="font-serif text-3xl mb-2 text-center">Real carts from real creators</h2>
          <p className="text-muted text-center mb-10">Tap to see what a follower sees.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exampleCarts.map((c) => (
              <CartCard key={c.id} cart={c} />
            ))}
          </div>
        </section>

        {/* VALUE PROPS */}
        <section className="border-t border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {[
                ["Free forever", "No paid tier, no card required."],
                ["All your links, one place", "Replace the link in your bio."],
                ["View + click analytics", "See what your followers love."],
                ["Funded by affiliate", "Revenue from purchases keeps it free."],
              ].map(([t, b]) => (
                <li key={t}>
                  <p className="font-medium mb-1">{t}</p>
                  <p className="text-muted leading-relaxed">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
