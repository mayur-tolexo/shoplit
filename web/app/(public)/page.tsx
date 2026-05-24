import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { CartCard } from "@/components/cart-card";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { listMyCarts } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // listMyCarts requires auth. For logged-out landing-page visitors it 401s,
  // which is expected — swallow it so the page renders with zero examples.
  // A dedicated /api/public/featured endpoint will replace this in v2.
  let exampleCarts: Awaited<ReturnType<typeof listMyCarts>> = [];
  try {
    exampleCarts = (await listMyCarts()).slice(0, 3);
  } catch {
    exampleCarts = [];
  }
  return (
    <>
      <NavBar variant="marketing" />
      <main>
        {/* HERO — animated gradient background + cascading phone mockups */}
        <section className="relative overflow-hidden">
          {/* Soft warm gradient blobs (CSS-animated) behind the hero */}
          <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
            <div
              className="absolute top-[-12%] left-[-10%] w-[55vw] h-[55vw] max-w-[640px] max-h-[640px] rounded-full opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(181,83,42,0.25), transparent 65%)",
                filter: "blur(40px)",
                animation: "shoplit-blob 16s ease-in-out infinite",
              }}
            />
            <div
              className="absolute top-[10%] right-[-15%] w-[60vw] h-[60vw] max-w-[720px] max-h-[720px] rounded-full opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 60% 40%, rgba(199,149,155,0.35), transparent 65%)",
                filter: "blur(56px)",
                animation: "shoplit-blob 22s ease-in-out -8s infinite",
              }}
            />
            <div
              className="absolute bottom-[-10%] left-[20%] w-[50vw] h-[50vw] max-w-[580px] max-h-[580px] rounded-full opacity-50"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(124,122,82,0.25), transparent 65%)",
                filter: "blur(48px)",
                animation: "shoplit-blob 26s ease-in-out -14s infinite",
              }}
            />
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-20">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-cream/80 backdrop-blur border border-rule px-3 py-1 mb-6 text-xs font-medium text-muted">
                  <Sparkles size={12} className="text-accent" />
                  Free forever — no card required
                </p>
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-[5.25rem] leading-[0.95] mb-6 tracking-tight">
                  Your favorite picks,
                  <br />
                  in <span className="italic text-accent">one link</span>.
                </h1>
                <p className="text-lg sm:text-xl text-muted mb-8 max-w-xl leading-relaxed">
                  Curate products from Amazon, Myntra, Nykaa and any shop online.
                  Share a single beautiful link your followers will actually love
                  opening.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-7 py-3.5 font-medium text-base hover:opacity-90 transition-opacity shadow-lg shadow-ink/10"
                  >
                    Start free <ArrowRight size={16} />
                  </Link>
                  {exampleCarts[0] && (
                    <Link
                      href={`/c/${exampleCarts[0].slug}`}
                      className="text-ink underline-offset-4 hover:underline transition-all font-medium"
                    >
                      See an example →
                    </Link>
                  )}
                </div>

                {/* Trust strip */}
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-accent" />
                    No paywall
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-accent" />
                    Click analytics included
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-accent" />
                    Works with any shopping site
                  </span>
                </div>
              </div>

              {/* Right side: cascading phone mockups (3 carts staggered) */}
              <div className="relative h-[28rem] sm:h-[32rem] lg:h-[36rem]">
                {exampleCarts.slice(0, 3).map((cart, i) => (
                  <PhoneCard key={cart.id} cart={cart} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-rule bg-paper">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
            <p className="text-sm text-accent uppercase tracking-widest text-center mb-2 font-medium">
              How it works
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl mb-12 text-center">
              Three steps. Two minutes.
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              {[
                ["Paste any product URL", "From Amazon, Myntra, Nykaa, Flipkart, AJIO — we auto-fill the title and image."],
                ["Customize your cart", "Pick a cover image and accent color. Add a short bio. Drag to reorder products."],
                ["Share the link", "A short, beautiful URL your followers can open from Instagram, WhatsApp, or anywhere."],
              ].map(([title, body], i) => (
                <RevealOnScroll key={title} index={i}>
                  <li className="rounded-xl border border-rule bg-cream p-6 h-full">
                    <p className="font-serif text-3xl mb-3 text-accent">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className="font-medium mb-2 text-lg">{title}</h3>
                    <p className="text-muted text-sm leading-relaxed">{body}</p>
                  </li>
                </RevealOnScroll>
              ))}
            </ol>
          </div>
        </section>

        {/* EXAMPLE CARTS */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <p className="text-sm text-accent uppercase tracking-widest text-center mb-2 font-medium">
            From our creators
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl mb-2 text-center">
            Real carts you can scroll through
          </h2>
          <p className="text-muted text-center mb-12">
            Tap to see what a follower sees.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exampleCarts.map((c, i) => (
              <RevealOnScroll key={c.id} index={i}>
                <CartCard cart={c} href={`/c/${c.slug}`} />
              </RevealOnScroll>
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
              ].map(([t, b], i) => (
                <RevealOnScroll key={t} index={i}>
                  <li>
                    <p className="font-medium mb-1">{t}</p>
                    <p className="text-muted leading-relaxed">{b}</p>
                  </li>
                </RevealOnScroll>
              ))}
            </ul>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl mb-4 tracking-tight">
              Your first shoplit link is one paste away.
            </h2>
            <p className="text-muted mb-8 max-w-xl mx-auto">
              Sign in with Google, paste your first product URL, share. That&apos;s the
              whole flow.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-7 py-3.5 font-medium text-base hover:opacity-90 transition-opacity shadow-lg shadow-ink/10"
            >
              Start free <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// Cascading phone mockup. Three of these stack with offsets so the hero
// looks like a small gallery of cart pages on phones.
function PhoneCard({
  cart,
  index,
}: {
  cart: { id: string; slug: string; title: string; ownerHandle: string; coverImageUrl: string };
  index: number;
}) {
  // Layout: index 0 is the front phone, larger; 1 and 2 are smaller, offset behind.
  const front = index === 0;
  const positions: React.CSSProperties[] = [
    // front phone
    {
      right: "8%",
      top: "10%",
      width: "min(70%, 280px)",
      transform: "rotate(2deg)",
      zIndex: 30,
    },
    // back-left
    {
      right: "40%",
      top: "5%",
      width: "min(54%, 220px)",
      transform: "rotate(-8deg)",
      zIndex: 20,
      opacity: 0.95,
    },
    // back-right-deep
    {
      right: "-4%",
      bottom: "4%",
      width: "min(48%, 200px)",
      transform: "rotate(6deg)",
      zIndex: 10,
      opacity: 0.85,
    },
  ];
  const style = positions[index] ?? positions[0];

  return (
    <div
      className="absolute aspect-[9/16] rounded-[2rem] overflow-hidden border-4 border-ink bg-ink shadow-2xl"
      style={style}
    >
      <Image
        src={cart.coverImageUrl}
        alt=""
        fill
        sizes="(max-width: 1024px) 50vw, 25vw"
        className="object-cover"
        priority={front}
        unoptimized
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 text-cream">
        <p className="font-serif text-lg sm:text-xl leading-tight">
          {cart.title}
        </p>
        <p className="text-[10px] sm:text-xs opacity-80 mt-0.5">
          @{cart.ownerHandle}
        </p>
      </div>
    </div>
  );
}
