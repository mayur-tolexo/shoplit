import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCartBySlug } from "@/lib/api-client";
import { ProductCard } from "@/components/product-card";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { StickyShareBar } from "@/components/sticky-share-bar";
import { CartCover } from "@/components/cart-cover";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cart = await getCartBySlug(params.slug);
  if (!cart) return { title: "Not found · shoplit" };
  return {
    title: `${cart.title} · ${cart.ownerDisplayName}`,
    description: cart.bio ?? `${cart.products.length} curated products from ${cart.ownerDisplayName}.`,
    openGraph: {
      title: cart.title,
      description: cart.bio ?? "",
      // Only advertise a social-preview image for an absolute cover URL. The
      // gradient fallback is a CSS effect, and curated covers are relative
      // asset paths — neither is a shareable absolute image URL.
      ...(/^https?:\/\//.test(cart.coverImageUrl) ? { images: [{ url: cart.coverImageUrl }] } : {}),
    },
  };
}

export default async function PublicCartPage({ params }: { params: { slug: string } }) {
  const cart = await getCartBySlug(params.slug);
  if (!cart) notFound();
  return (
    <div style={{ ["--accent" as string]: cart.accentHex } as React.CSSProperties}>
      {/* HERO */}
      <section className="relative w-full" style={{ height: "min(70vh, 640px)" }}>
        <CartCover
          coverImageUrl={cart.coverImageUrl}
          accentHex={cart.accentHex}
          title={cart.title}
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 max-w-3xl mx-auto text-cream">
          <div className="flex items-center gap-2 mb-3">
            <Image src={cart.ownerAvatarUrl} alt="" width={32} height={32} className="rounded-full border border-cream/30" unoptimized />
            <span className="text-sm opacity-90">@{cart.ownerHandle}</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">{cart.title}</h1>
          {cart.bio && <p className="text-base opacity-90 max-w-xl leading-relaxed">{cart.bio}</p>}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
        {cart.products.length === 0 ? (
          <p className="text-center text-muted py-16">This cart is still being curated. Check back soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {cart.products.map((p, i) => (
              <RevealOnScroll key={p.id} index={i}>
                <ProductCard product={p} eagerImage={i < 2} />
              </RevealOnScroll>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER (extra bottom padding so it isn't covered by the sticky share bar) */}
      <footer className="border-t border-rule mt-16 pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 text-sm text-muted text-center space-y-3">
          <p>curated by <strong className="text-ink">@{cart.ownerHandle}</strong></p>
          <p className="text-xs">
            shoplit links contain affiliate tags. We may earn a commission when you shop through them.
          </p>
          <p>
            <Link href="/" className="font-serif text-base text-ink hover:opacity-80">shoplit</Link>
            {" · "}
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
            {" · "}
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          </p>
        </div>
      </footer>

      <StickyShareBar slug={cart.slug} cartTitle={cart.title} ownerHandle={cart.ownerHandle} />
    </div>
  );
}
