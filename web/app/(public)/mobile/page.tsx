import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { Footer } from "@/components/footer";
import { Smartphone, Apple, Share2, ImageIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "shoplit on your phone · shoplit",
  description: "Add products to your shoplit cart in one tap from your phone — share from Nykaa, Myntra, Amazon, Flipkart & AJIO.",
};

const androidSteps = [
  { t: "Install shoplit", b: "Open shoplit.in in Chrome → menu (⋮) → “Add to Home screen”. A shoplit icon lands on your home screen. (You can also tap “Install app” on your dashboard.)" },
  { t: "Open a product & tap Share", b: "On Nykaa, Myntra, Amazon, Flipkart or AJIO, open the product page and tap the app’s Share button." },
  { t: "Choose shoplit", b: "Pick shoplit from the share sheet — it opens with the product link and title already filled in." },
  { t: "Pick a cart & add", b: "Tweak the price or image if you like, choose which cart it goes in, and tap Add. Done." },
];

const iosSteps = [
  { t: "Add to Home Screen", b: "Open shoplit.in in Safari → tap Share → “Add to Home Screen”. (iPhone doesn’t let apps share into shoplit — Apple limitation — so adding is by paste.)" },
  { t: "Copy the product link", b: "On the shopping app or site, tap Share → Copy (or copy the page address)." },
  { t: "Paste into shoplit", b: "Open shoplit, tap the ＋ Add button, and paste the link. shoplit fills in what it can from the link — add or tweak the title." },
  { t: "Pick a cart & add", b: "Adjust the price/image if needed, choose the cart, and add." },
];

export default function MobileGuidePage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        {/* HERO */}
        <div className="text-center mb-10">
          <span
            className="inline-grid place-items-center size-14 rounded-2xl text-accent mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Smartphone size={26} />
          </span>
          <p className="text-sm text-accent uppercase tracking-widest font-medium mb-2">shoplit on your phone</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">Add products in one tap</h1>
          <p className="text-muted text-lg leading-relaxed">
            No desktop, no copy-pasting details. Install shoplit on your phone and add products
            straight from your shopping apps.
          </p>
        </div>

        {/* ANDROID */}
        <section className="rounded-2xl border border-rule bg-cream p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone size={18} className="text-accent" />
            <h2 className="font-serif text-2xl">On Android</h2>
          </div>
          <ol className="space-y-5">
            {androidSteps.map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid place-items-center size-7 shrink-0 rounded-full bg-accent text-cream text-sm font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-sm text-muted leading-relaxed">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
            <Share2 size={15} className="text-accent" />
            Look for shoplit in the share sheet after installing.
          </div>
        </section>

        {/* iOS */}
        <section className="rounded-2xl border border-rule bg-paper p-6 sm:p-8 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Apple size={18} className="text-accent" />
            <h2 className="font-serif text-2xl">On iPhone</h2>
          </div>
          <ol className="space-y-5">
            {iosSteps.map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid place-items-center size-7 shrink-0 rounded-full bg-ink text-cream text-sm font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-sm text-muted leading-relaxed">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* IMAGE NOTE */}
        <div className="mt-6 rounded-2xl border border-rule bg-cream p-5 flex items-start gap-3">
          <ImageIcon size={18} className="text-accent mt-0.5 shrink-0" />
          <p className="text-sm text-muted leading-relaxed">
            <strong className="text-ink">About images:</strong> on mobile, paste an image URL if you have one —
            otherwise leave it blank and your cart shows a clean placeholder you can update anytime from the editor.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/add"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            Add a product by link →
          </Link>
          <Link href="/login" className="text-ink underline-offset-4 hover:underline font-medium">
            No account yet? Create one free
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
