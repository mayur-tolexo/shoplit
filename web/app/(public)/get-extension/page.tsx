import type { Metadata } from "next";
import Link from "next/link";
import { Puzzle, Monitor, Smartphone } from "lucide-react";

const STORE_URL = "https://chromewebstore.google.com/detail/shoplit-%E2%80%94-add-to-cart/dplbbiamddaaimhjennfncbpbnkfconn";

export const metadata: Metadata = {
  title: "Get the shoplit extension · shoplit",
  description: "Add products to your shoplit cart in one click from Amazon, Myntra, Nykaa, Flipkart & AJIO — free on the Chrome Web Store.",
};

const desktopSteps = [
  { t: "Add it from the Chrome Web Store", b: "Tap the button above and choose “Add to Chrome”. Works in Chrome, Edge and Brave. Pin the shoplit icon so it's one click away." },
  { t: "Connect your account", b: "Open the connect page while signed in to shoplit — the extension links automatically, no code to copy or paste." },
  { t: "Start adding", b: "Open any product on Amazon, Myntra, Nykaa, Flipkart or AJIO and hit “＋ Add to shoplit”." },
];

const mobileSteps = [
  { t: "Install shoplit", b: "Open shoplit.in in Chrome on your phone → menu (⋮) → “Add to Home screen”. (On iPhone: Safari → Share → Add to Home Screen.)" },
  { t: "Open a product & tap Share", b: "On Nykaa, Myntra, Amazon, Flipkart or AJIO, open the product and tap the app’s Share button." },
  { t: "Choose shoplit (Android)", b: "Pick shoplit from the share sheet — it opens with the link and title already filled in. iPhone: copy the link, open shoplit and paste it on the Add screen." },
  { t: "Pick a cart & add", b: "Choose the cart, tweak the price/image if you like, and add. Done — no typing it all out." },
];

export default function GetExtensionPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
      <div className="text-center mb-10">
          <span
            className="inline-grid place-items-center size-14 rounded-2xl text-accent mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Puzzle size={26} />
          </span>
          <p className="text-sm text-accent uppercase tracking-widest font-medium mb-2">Browser extension</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">Add to shoplit in one click</h1>
          <p className="text-muted text-lg leading-relaxed">
            Grab products straight from the product page — no copy-pasting links. Now live and free
            on the Chrome Web Store.
          </p>
        </div>

        {/* DESKTOP */}
        <section className="rounded-2xl border border-rule bg-cream p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={18} className="text-accent" />
            <h2 className="font-serif text-2xl">On desktop (Chrome, Edge, Brave)</h2>
          </div>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            <Puzzle size={18} /> Add to Chrome — free
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
            an Android/iOS limitation, not a shoplit one. Install shoplit as a home-screen app and
            use the native share sheet instead — it&apos;s just as fast.
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
          <Link
            href="/add"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90"
          >
            Add a product by link →
          </Link>
          <p className="text-xs text-muted mt-6 leading-relaxed">
            Power users on Android: <strong className="text-ink">Kiwi Browser</strong> supports Chrome
            extensions — you can install shoplit from the Chrome Web Store there too.
          </p>
        </section>

        <p className="text-center text-sm text-muted mt-6">
          On a phone?{" "}
          <Link href="/mobile" className="text-accent underline underline-offset-4 hover:opacity-80">
            See the full mobile guide →
          </Link>
        </p>
    </div>
  );
}
