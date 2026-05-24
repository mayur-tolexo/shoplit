import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Eye, MousePointerClick, Plus, ShoppingBag, Sparkles } from "lucide-react";
import type { Cart, User } from "@/lib/types";
import { getCurrentUser, listMyCarts } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { AnimatedNumber } from "@/components/animated-number";
import { InstallNudge } from "@/components/install-nudge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Forward the incoming request's cookies to the backend so authenticated
  // server-side calls see the same session the browser does.
  const cookie = cookies().toString();
  let user: User;
  let carts: Cart[];
  try {
    [user, carts] = await Promise.all([
      getCurrentUser({ cookie }),
      listMyCarts({ cookie }),
    ]);
  } catch {
    // 401 (or any auth failure) → kick to /login. The client-side NavBar
    // also redirects on its own getCurrentUser() failure; this one is the
    // server-side guard so the page never renders without auth.
    redirect("/login");
  }

  const totals = carts.reduce(
    (acc, c) => ({
      views: acc.views + (c.viewsLast7d || 0),
      clicks: acc.clicks + (c.clicksLast7d || 0),
    }),
    { views: 0, clicks: 0 },
  );

  const firstName = user.displayName.split(" ")[0] || "creator";
  const isEmpty = carts.length === 0;
  const productCount = carts.reduce((n, c) => n + (c.products?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-24 sm:pb-10">
      {/* GREETING */}
      <div className="flex items-center gap-4 mb-8">
        {user.avatarUrl && (
          <Image
            src={user.avatarUrl}
            width={56}
            height={56}
            alt={user.displayName}
            unoptimized
            className="rounded-full border border-rule shrink-0"
          />
        )}
        <div>
          <p className="text-sm text-muted mb-0.5">
            {isEmpty ? "Welcome to shoplit" : "Welcome back"}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-none">
            {isEmpty ? `Hi ${firstName} 👋` : `Your carts, ${firstName}`}
          </h1>
        </div>
      </div>

      <InstallNudge />

      {isEmpty ? (
        <FirstTimeOnboarding firstName={firstName} />
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-12">
            <StatCard
              icon={<ShoppingBag size={18} />}
              label="Active carts"
              value={carts.length}
              hint={`${productCount} ${productCount === 1 ? "product" : "products"} curated`}
            />
            <StatCard
              icon={<Eye size={18} />}
              label="Views"
              value={totals.views}
              hint="across all carts · 7d"
            />
            <StatCard
              icon={<MousePointerClick size={18} />}
              label="Clicks"
              value={totals.clicks}
              hint="through to retailers · 7d"
            />
          </div>

          {/* HEADER ROW */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl">All carts</h2>
            <Link
              href="/dashboard/carts/new"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> New cart
            </Link>
          </div>

          {/* GRID */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {carts.map((c) => (
              <CartCard key={c.id} cart={c} />
            ))}
            <NewCartTile />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="group rounded-2xl border border-rule bg-cream p-4 sm:p-6 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span
          className="grid place-items-center size-9 sm:size-10 rounded-xl text-accent"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          {icon}
        </span>
      </div>
      <p className="font-serif text-3xl sm:text-4xl tabular-nums leading-none mb-1.5">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-xs sm:text-sm font-medium">{label}</p>
      <p className="text-xs text-muted mt-0.5 hidden sm:block">{hint}</p>
    </div>
  );
}

function NewCartTile() {
  return (
    <Link
      href="/dashboard/carts/new"
      className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-rule text-muted hover:border-accent hover:text-accent transition-colors min-h-[220px]"
    >
      <span className="grid place-items-center size-12 rounded-full border-2 border-current">
        <Plus size={22} />
      </span>
      <span className="font-medium text-sm">New cart</span>
      <span className="text-xs text-muted group-hover:text-accent/80">Start curating</span>
    </Link>
  );
}

function FirstTimeOnboarding({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-paper p-6 sm:p-10">
      <div className="flex items-start gap-3 mb-4">
        <Sparkles size={20} className="text-accent shrink-0 mt-1" />
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl mb-2">
            Let&apos;s build your first cart, {firstName}
          </h2>
          <p className="text-muted leading-relaxed max-w-xl">
            Curate a few products you love into a single shareable link.
            Followers tap, you get the click. Free forever.
          </p>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3 mb-6 mt-8">
        <Step n={1} title="Name your cart" body="Something short — &quot;Diwali Edit&quot;, &quot;Desk Setup&quot;." />
        <Step n={2} title="Paste product URLs" body="Amazon, Myntra, Nykaa — we pull the title and image." />
        <Step n={3} title="Share the link" body="One URL, beautifully laid out for your followers." />
      </ol>

      <Link
        href="/dashboard/carts/new"
        className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={16} /> Create your first cart
      </Link>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-lg bg-cream border border-rule p-4">
      <p className="font-serif text-xl mb-1 text-accent">{n}.</p>
      <p className="font-medium text-sm mb-1">{title}</p>
      <p className="text-xs text-muted leading-relaxed">{body}</p>
    </li>
  );
}
