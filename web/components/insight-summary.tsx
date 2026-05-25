import { MousePointerClick, Package, ShoppingBag, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { Cart, DailyStat } from "@/lib/types";
import { summarizeDaily } from "@/lib/insights";
import { AnimatedNumber } from "@/components/animated-number";
import { Sparkline } from "@/components/sparkline";

// The insights headline card: views this week (animated) with a week-over-week
// delta chip, a 14-day views sparkline, and a wrapping row of supporting
// metrics. Everything is derived: the daily series powers the headline +
// sparkline, while reach/carts/products are summed from the carts list (the
// same data the cart grid renders). No interactivity beyond AnimatedNumber.
export function InsightSummary({ daily, carts }: { daily: DailyStat[]; carts: Cart[] }) {
  const s = summarizeDaily(daily);
  const viewSeries = (daily ?? []).map((d) => d.views);

  const reach7d = carts.reduce((acc, c) => acc + (c.reachLast7d || 0), 0);
  const productCount = carts.reduce((n, c) => n + (c.products?.length ?? 0), 0);

  return (
    <div className="rounded-2xl border border-rule bg-cream p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-muted">Views this week</p>
          <div className="flex items-center gap-3">
            <p className="font-serif text-5xl leading-none tabular-nums sm:text-6xl">
              <AnimatedNumber value={s.viewsThisWeek} />
            </p>
            <DeltaChip pct={s.viewsDeltaPct} prevZero={s.viewsPrevWeek === 0} />
          </div>
          <p className="mt-1.5 text-xs text-muted">vs {s.viewsPrevWeek.toLocaleString()} last week</p>
        </div>
      </div>

      {/* 14-day views sparkline — responsive width, accent stroke. */}
      <div className="mt-5 text-accent">
        <Sparkline values={viewSeries} />
      </div>

      {/* Supporting metrics — wraps on narrow screens. */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip icon={<MousePointerClick size={14} />} value={s.clicksThisWeek} label="clicks · 7d" />
        <Chip icon={<Users size={14} />} value={reach7d} label="reach · 7d" />
        <Chip icon={<ShoppingBag size={14} />} value={carts.length} label={carts.length === 1 ? "cart" : "carts"} />
        <Chip icon={<Package size={14} />} value={productCount} label={productCount === 1 ? "product" : "products"} />
      </div>
    </div>
  );
}

function DeltaChip({ pct, prevZero }: { pct: number | null; prevZero: boolean }) {
  // No prior-week baseline → "New" badge instead of a misleading percentage.
  if (pct === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-muted">
        {prevZero ? "New" : "—"}
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
      style={
        up
          ? { backgroundColor: "color-mix(in srgb, #2f7d4f 14%, transparent)", color: "#2f7d4f" }
          : { backgroundColor: "var(--paper)", color: "var(--muted)" }
      }
    >
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Chip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-3 py-1.5 text-sm">
      <span className="text-accent">{icon}</span>
      <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}
