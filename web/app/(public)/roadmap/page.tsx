import type { Metadata } from "next";
import Link from "next/link";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import {
  Lock, ImageUp, UsersRound, Search, Rss, Heart, Star,
  Wallet, BellRing, FolderHeart, Puzzle, Smartphone, ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Roadmap · shoplit",
  description: "What's shipping next on shoplit — and tell us what to build.",
};

type Status = "Live" | "Beta" | "Soon" | "Planned" | "Exploring";

const STATUS_STYLE: Record<Status, string> = {
  Live: "bg-ink text-cream",
  Beta: "bg-accent text-cream",
  Soon: "bg-accent/15 text-accent",
  Planned: "bg-ink/10 text-ink",
  Exploring: "border border-rule text-muted",
};

interface Item {
  icon: React.ReactNode;
  title: string;
  body: string;
  status: Status;
}

const ITEMS: Item[] = [
  { icon: <Puzzle size={20} />, title: "Browser extension", status: "Live",
    body: "Add products to your cart in one click from Amazon, Myntra, Nykaa, Flipkart & AJIO — straight from the product page. Free on the Chrome Web Store." },
  { icon: <Smartphone size={20} />, title: "Add from your phone", status: "Live",
    body: "No desktop needed — share a product from any shopping app into shoplit, or paste the link. Install shoplit to your home screen and add on the go." },
  { icon: <ImageUp size={20} />, title: "Upload your own photos", status: "Live",
    body: "Add product and cover images straight from your phone or computer — tap “📷 Add a photo”, no image URL needed." },
  { icon: <Lock size={20} />, title: "Public & private carts", status: "Soon",
    body: "Decide who can see each cart — keep some public, others just for you until you're ready to share." },
  { icon: <UsersRound size={20} />, title: "Share with select people", status: "Soon",
    body: "Private links you can share with a chosen few — perfect for client edits or close-friends drops." },
  { icon: <Wallet size={20} />, title: "Earnings dashboard", status: "Planned",
    body: "See clicks, conversions and affiliate earnings per cart and product — know what's working." },
  { icon: <Search size={20} />, title: "Discover creators", status: "Exploring",
    body: "Search creators and browse their carts — a place to find taste you trust before you shop." },
  { icon: <UsersRound size={20} />, title: "Follow creators", status: "Exploring",
    body: "Follow your favourites and get notified when they drop a new cart or product." },
  { icon: <Rss size={20} />, title: "Your feed", status: "Exploring",
    body: "A home feed of fresh carts and finds from the creators you follow." },
  { icon: <Heart size={20} />, title: "Wishlists", status: "Exploring",
    body: "Save products you love from any cart into your own wishlist to shop later." },
  { icon: <Star size={20} />, title: "Reviews & ratings", status: "Exploring",
    body: "Creators and shoppers rate products, so recommendations come with real signal." },
  { icon: <FolderHeart size={20} />, title: "Collections", status: "Exploring",
    body: "Group carts into themed collections on your profile — \"Skincare\", \"Diwali\", \"Desk setup\"." },
  { icon: <BellRing size={20} />, title: "Price-drop alerts", status: "Exploring",
    body: "Get pinged when a product you saved drops in price." },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* HERO */}
        <section className="pt-16 pb-10 sm:pt-24 sm:pb-14 text-center max-w-2xl mx-auto">
          <p className="text-sm text-accent uppercase tracking-widest font-medium mb-3">Roadmap</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-4">Where shoplit is headed</h1>
          <p className="text-muted text-lg leading-relaxed mb-8">
            shoplit is just getting started. Here&apos;s what we&apos;re building next — and the
            single best way to shape it is to tell us what you want.
          </p>
          <Link
            href="/feedback"
            className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            Request a feature
          </Link>
        </section>

        {/* GRID */}
        <section className="pb-16">
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ITEMS.map((it, i) => (
              <RevealOnScroll key={it.title} index={i}>
                <article className="h-full rounded-2xl border border-rule bg-cream p-5 sm:p-6 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="grid place-items-center size-10 rounded-xl text-accent"
                      style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                    >
                      {it.icon}
                    </span>
                    <span className={`text-[11px] font-medium uppercase tracking-wider rounded-full px-2.5 py-1 ${STATUS_STYLE[it.status]}`}>
                      {it.status}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl mb-1.5">{it.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{it.body}</p>
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="pb-24">
          <div className="rounded-2xl bg-ink text-cream px-6 sm:px-10 py-10 sm:py-14 text-center">
            <h2 className="font-serif text-3xl sm:text-4xl mb-3">Got an idea? We&apos;re listening.</h2>
            <p className="text-cream/80 max-w-xl mx-auto mb-7 leading-relaxed">
              Every feature here started as a creator&apos;s request. Tell us what would make
              shoplit indispensable for you — we read every email.
            </p>
            <Link
              href="/feedback"
              className="inline-flex items-center gap-2 rounded-full bg-accent text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
            >
              Share your idea <ArrowRight size={16} />
            </Link>
          </div>
        </section>
    </div>
  );
}
