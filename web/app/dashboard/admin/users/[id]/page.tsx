import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Lock, MousePointerClick } from "lucide-react";
import type { AdminUserCart, User } from "@/lib/types";
import { getAdminUserCarts, getCurrentUser } from "@/lib/api-client";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function AdminUserCartsPage({ params }: { params: { id: string } }) {
  // Forward the browser session so the admin-only backend calls authenticate.
  const cookie = cookies().toString();

  // Same cosmetic admin gate as the overview; the API enforces with a 403.
  let user: User;
  try {
    user = await getCurrentUser({ cookie });
  } catch {
    notFound();
  }
  if (!user.isAdmin) notFound();

  let carts: AdminUserCart[];
  try {
    carts = await getAdminUserCarts(params.id, { cookie });
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24 sm:px-6 sm:pb-10">
      {/* BACK LINK */}
      <Link
        href="/dashboard/admin"
        className="-ml-2 mb-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to admin
      </Link>

      <h1 className="mb-1 font-serif text-3xl tracking-tight sm:text-4xl">User carts</h1>
      <p className="mb-8 text-sm text-muted">
        {carts.length.toLocaleString()} {carts.length === 1 ? "cart" : "carts"} for this account.
      </p>

      {carts.length === 0 ? (
        <p className="rounded-xl border border-rule bg-paper p-6 text-sm text-muted">
          This user has no carts.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-cream">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Cart</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 text-right font-medium">Products</th>
                <th className="px-4 py-3 text-right font-medium">Views · 7d</th>
                <th className="px-4 py-3 text-right font-medium">Clicks · 7d</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {carts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-rule/60 last:border-0 transition-colors hover:bg-paper"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/c/${c.slug}`}
                      className="-mx-2 flex min-h-[44px] items-center rounded-md px-2 font-medium text-ink hover:text-accent"
                    >
                      <span className="block max-w-[260px] truncate">{c.title || "Untitled"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <VisibilityBadge visibility={c.visibility} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.products.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Eye size={13} className="text-muted" /> {c.views7d.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      <MousePointerClick size={13} className="text-muted" />{" "}
                      {c.clicks7d.toLocaleString()}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">
                    {relativeTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: AdminUserCart["visibility"] }) {
  if (visibility === "private") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink/85 px-2 py-0.5 text-[11px] font-medium text-cream">
        <Lock size={11} aria-hidden /> Private
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-rule bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
      Public
    </span>
  );
}
