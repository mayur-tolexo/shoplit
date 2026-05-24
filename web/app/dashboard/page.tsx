import Link from "next/link";
import { Eye, MousePointerClick, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { getCurrentUser, listMyCarts } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { AnimatedNumber } from "@/components/animated-number";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [user, carts] = await Promise.all([getCurrentUser(), listMyCarts()]);

  const totals = carts.reduce(
    (acc, c) => ({
      views: acc.views + (c.viewsLast7d || 0),
      clicks: acc.clicks + (c.clicksLast7d || 0),
    }),
    { views: 0, clicks: 0 },
  );

  const firstName = user.displayName.split(" ")[0] || "creator";
  const isEmpty = carts.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-24 sm:pb-10">
      {/* GREETING */}
      <div className="mb-8">
        <p className="text-sm text-muted mb-1">
          {isEmpty ? "Welcome to shoplit" : "Welcome back"}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">
          {isEmpty ? `Hi ${firstName} 👋` : `Your carts, ${firstName}`}
        </h1>
      </div>

      {isEmpty ? (
        <FirstTimeOnboarding firstName={firstName} />
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-10">
            <StatCard
              icon={<ShoppingBag size={16} className="text-muted" />}
              label="Active carts"
              value={carts.length}
            />
            <StatCard
              icon={<Eye size={16} className="text-muted" />}
              label="Views (7d)"
              value={totals.views}
            />
            <StatCard
              icon={<MousePointerClick size={16} className="text-muted" />}
              label="Clicks (7d)"
              value={totals.clicks}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-rule bg-cream px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs sm:text-sm text-muted">{label}</p>
      </div>
      <p className="font-serif text-2xl sm:text-3xl tabular-nums">
        <AnimatedNumber value={value} />
      </p>
    </div>
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
