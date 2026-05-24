import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { Footer } from "@/components/footer";
import { Download, Puzzle, Monitor, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Get the shoplit extension (beta) · shoplit",
  description: "Add products to your shoplit cart in one click from Amazon, Myntra, Nykaa, Flipkart & AJIO.",
};

const desktopSteps = [
  { t: "Download & unzip", b: "Download the file below and unzip it — you'll get a folder called shoplit-extension." },
  { t: "Open Chrome extensions", b: "Go to chrome://extensions and turn on Developer mode (top-right toggle)." },
  { t: "Load it", b: "Click “Load unpacked” and select the unzipped shoplit-extension folder. Pin the shoplit icon." },
  { t: "Connect your account", b: "Open the connect page, copy the code shown there, and paste it into the extension's popup → Connect." },
  { t: "Start adding", b: "Open any product on Amazon, Myntra, Nykaa, Flipkart or AJIO and hit “＋ Add to shoplit”." },
];

const mobileSteps = [
  { t: "Open the product in your shopping app", b: "On Nykaa, Myntra, Amazon, Flipkart or AJIO, open the product page." },
  { t: "Tap Share → Copy", b: "Use the app's Share button and copy the link (or the whole “Check out this product…” text)." },
  { t: "Paste into shoplit", b: "On shoplit.in open your cart, and in “Add a product” paste it. shoplit pulls the title automatically." },
  { t: "Add", b: "Tweak the price/image if needed, pick the cart, and add. Done — no extension required." },
];

export default function GetExtensionPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <span
            className="inline-grid place-items-center size-14 rounded-2xl text-accent mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Puzzle size={26} />
          </span>
          <p className="text-sm text-accent uppercase tracking-widest font-medium mb-2">Browser extension · Beta</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">Add to shoplit in one click</h1>
          <p className="text-muted text-lg leading-relaxed">
            Grab products straight from the product page — no copy-pasting links. It&apos;s pending
            Chrome Web Store review; until then, set it up manually (a minute on desktop).
          </p>
        </div>

        {/* DESKTOP */}
        <section className="rounded-2xl border border-rule bg-cream p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={18} className="text-accent" />
            <h2 className="font-serif text-2xl">On desktop (Chrome, Edge, Brave)</h2>
          </div>
          <a
            href="/shoplit-extension.zip"
            download
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            <Download size={18} /> Download for Chrome
          </a>
          <ol className="mt-7 space-y-5">
            {desktopSteps.map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid place-items-center size-7 shrink-0 rounded-full bg-accent text-cream text-sm font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-sm text-muted leading-relaxed">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 pt-6 border-t border-rule flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/connect-extension" className="text-accent font-medium underline underline-offset-4 hover:opacity-80">
              Open the connect page →
            </Link>
            <span className="text-muted">No account yet? <Link href="/login" className="text-ink hover:underline underline-offset-4">Create one free</Link></span>
          </div>
        </section>

        {/* MOBILE */}
        <section className="rounded-2xl border border-rule bg-paper p-6 sm:p-8 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={18} className="text-accent" />
            <h2 className="font-serif text-2xl">On mobile</h2>
          </div>
          <p className="text-sm text-muted leading-relaxed mb-5">
            Heads up: <strong className="text-ink">Chrome on phones doesn&apos;t support extensions</strong> — that&apos;s
            an Android/iOS limitation, not a shoplit one. But you don&apos;t need it: add products by
            sharing the link into shoplit.
          </p>
          <ol className="space-y-5">
            {mobileSteps.map((s, i) => (
              <li key={s.t} className="flex gap-4">
                <span className="grid place-items-center size-7 shrink-0 rounded-full bg-ink text-cream text-sm font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-sm text-muted leading-relaxed">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted mt-6 leading-relaxed">
            Power users on Android: <strong className="text-ink">Kiwi Browser</strong> does support Chrome
            extensions — you can load the same downloaded folder there via its Extensions menu.
          </p>
        </section>

        <p className="text-center text-xs text-muted mt-6">
          Once it&apos;s approved on the Chrome Web Store, desktop install becomes a single click — we&apos;ll update this page.
        </p>
      </main>
      <Footer />
    </>
  );
}
