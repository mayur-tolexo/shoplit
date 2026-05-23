import Link from "next/link";
import { Plus } from "lucide-react";
import { listMyCarts } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const carts = await listMyCarts();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl">Your carts</h1>
        <Link
          href="/dashboard/carts/new"
          className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New cart
        </Link>
      </div>

      {carts.length === 0 ? (
        <EmptyState
          illustration="/illustrations/empty-carts.svg"
          title="Your first cart is one paste away"
          body="Pick a product, paste the link, and we'll do the rest."
          cta={
            <Link
              href="/dashboard/carts/new"
              className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90"
            >
              <Plus size={16} /> Create cart
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {carts.map((c) => (
            <CartCard key={c.id} cart={c} />
          ))}
        </div>
      )}
    </div>
  );
}
