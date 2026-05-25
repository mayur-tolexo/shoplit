import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import type { Cart, DailyStat, User } from "@/lib/types";
import { getCurrentUser, getInsights, listMyCarts } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { InstallNudge } from "@/components/install-nudge";
import { DashboardHero } from "@/components/dashboard-hero";
import { InsightSummary } from "@/components/insight-summary";
import { TopCartCard } from "@/components/top-cart-card";
import { RevealOnScroll } from "@/components/reveal-on-scroll";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Forward the incoming request's cookies to the backend so authenticated
  // server-side calls see the same session the browser does.
  const cookie = cookies().toString();
  let user: User;
  let carts: Cart[];
  let daily: DailyStat[] = [];
  try {
    // Insights must never break the dashboard — fetch it alongside the
    // critical calls but swallow its failures into an empty series.
    [user, carts, daily] = await Promise.all([
      getCurrentUser({ cookie }),
      listMyCarts({ cookie }),
      getInsights({ cookie }).catch(() => [] as DailyStat[]),
    ]);
  } catch {
    // 401 (or any auth failure) → kick to /login. The client-side NavBar
    // also redirects on its own getCurrentUser() failure; this one is the
    // server-side guard so the page never renders without auth.
    redirect("/login");
  }

  const firstName = user.displayName.split(" ")[0] || "creator";
  const isEmpty = carts.length === 0;

  // The featured "top cart" = highest 7-day views. TopCartCard hides itself
  // when that cart has no views yet.
  const topCart = isEmpty
    ? null
    : carts.reduce((best, c) =>
        (c.viewsLast7d || 0) > (best.viewsLast7d || 0) ? c : best,
      );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24 sm:px-6 sm:pb-10">
      <DashboardHero user={user} />

      <InstallNudge />

      {isEmpty ? (
        <FirstTimeOnboarding firstName={firstName} />
      ) : (
        <>
          {/* INSIGHTS + TOP CART */}
          <div className="mb-12 grid gap-6 lg:grid-cols-2">
            <InsightSummary daily={daily} carts={carts} />
            <TopCartCard cart={topCart} />
          </div>

          {/* HEADER ROW */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl">Your carts</h2>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/add"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 font-medium text-cream transition-opacity hover:opacity-90"
              >
                <Plus size={16} /> Add a product
              </Link>
              <Link
                href="/dashboard/carts/new"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink px-4 font-medium transition-colors hover:bg-paper"
              >
                New cart
              </Link>
            </div>
          </div>

          {/* GRID */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {carts.map((c, i) => (
              <RevealOnScroll key={c.id} index={i}>
                <CartCard cart={c} />
              </RevealOnScroll>
            ))}
            <RevealOnScroll index={carts.length}>
              <NewCartTile />
            </RevealOnScroll>
          </div>
        </>
      )}
    </div>
  );
}

function NewCartTile() {
  return (
    <Link
      href="/dashboard/carts/new"
      className="group flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rule text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <span className="grid size-12 place-items-center rounded-full border-2 border-current">
        <Plus size={22} />
      </span>
      <span className="text-sm font-medium">New cart</span>
      <span className="text-xs text-muted group-hover:text-accent/80">Start curating</span>
    </Link>
  );
}

function FirstTimeOnboarding({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-paper p-6 sm:p-10">
      <div className="mb-4 flex items-start gap-3">
        <Sparkles size={20} className="mt-1 shrink-0 text-accent" />
        <div>
          <h2 className="mb-2 font-serif text-2xl sm:text-3xl">
            Let&apos;s build your first cart, {firstName}
          </h2>
          <p className="max-w-xl leading-relaxed text-muted">
            Curate a few products you love into a single shareable link.
            Followers tap, you get the click. Free forever.
          </p>
        </div>
      </div>

      <ol className="mb-6 mt-8 grid gap-4 sm:grid-cols-3">
        <Step n={1} title="Name your cart" body="Something short — &quot;Diwali Edit&quot;, &quot;Desk Setup&quot;." />
        <Step n={2} title="Paste product URLs" body="Amazon, Myntra, Nykaa — we pull the title and image." />
        <Step n={3} title="Share the link" body="One URL, beautifully laid out for your followers." />
      </ol>

      <Link
        href="/dashboard/carts/new"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-6 font-medium text-cream transition-opacity hover:opacity-90"
      >
        <Plus size={16} /> Create your first cart
      </Link>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-lg border border-rule bg-cream p-4">
      <p className="mb-1 font-serif text-xl text-accent">{n}.</p>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="text-xs leading-relaxed text-muted">{body}</p>
    </li>
  );
}
