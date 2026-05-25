import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  Eye,
  MousePointerClick,
  Package,
  ShieldCheck,
  ShoppingBag,
  UserPlus,
  Users,
} from "lucide-react";
import type { AdminOverview, AdminUser, User } from "@/lib/types";
import { getAdminOverview, getAdminUsers, getCurrentUser } from "@/lib/api-client";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // Forward the browser session so the admin-only backend calls authenticate.
  const cookie = cookies().toString();

  // The page-level gate is cosmetic — the API enforces admin with a 403 — but
  // it keeps non-admins from ever seeing the shell. A failed /me also lands here.
  let user: User;
  try {
    user = await getCurrentUser({ cookie });
  } catch {
    notFound();
  }
  if (!user.isAdmin) notFound();

  let overview: AdminOverview;
  let users: AdminUser[];
  try {
    [overview, users] = await Promise.all([
      getAdminOverview({ cookie }),
      getAdminUsers({ cookie }),
    ]);
  } catch {
    // 403 (lost admin) / any backend failure → treat as not found rather than
    // rendering a broken panel.
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24 sm:px-6 sm:pb-10">
      {/* HEADER */}
      <div className="mb-8 flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl text-accent"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <ShieldCheck size={20} />
        </span>
        <div>
          <h1 className="font-serif text-3xl leading-none tracking-tight sm:text-4xl">Admin</h1>
          <p className="mt-1 text-sm text-muted">Platform totals and every account, read-only.</p>
        </div>
      </div>

      {/* OVERVIEW STAT CARDS */}
      <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <StatCard icon={<Users size={16} />} label="Users" value={overview.users} />
        <StatCard
          icon={<ShoppingBag size={16} />}
          label="Carts"
          value={overview.carts}
          sub={`${overview.publicCarts.toLocaleString()} public · ${overview.privateCarts.toLocaleString()} private`}
        />
        <StatCard icon={<Package size={16} />} label="Products" value={overview.products} />
        <StatCard icon={<UserPlus size={16} />} label="Follows" value={overview.follows} />
        <StatCard icon={<Eye size={16} />} label="Views · 7d" value={overview.views7d} />
        <StatCard
          icon={<MousePointerClick size={16} />}
          label="Clicks · 7d"
          value={overview.clicks7d}
        />
      </div>

      {/* USERS TABLE */}
      <h2 className="mb-4 font-serif text-2xl">
        Users{" "}
        <span className="text-base font-normal text-muted">({users.length.toLocaleString()})</span>
      </h2>

      {users.length === 0 ? (
        <p className="rounded-xl border border-rule bg-paper p-6 text-sm text-muted">
          No users yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-cream">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Carts</th>
                <th className="px-4 py-3 text-right font-medium">Followers</th>
                <th className="px-4 py-3 text-right font-medium">Following</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-rule/60 last:border-0 transition-colors hover:bg-paper"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="-mx-2 flex min-h-[44px] items-center gap-3 rounded-md px-2"
                    >
                      {u.avatarUrl ? (
                        <Image
                          src={u.avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 shrink-0 rounded-full border border-rule"
                        />
                      ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-rule bg-paper text-muted">
                          <Users size={14} />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {u.displayName || "—"}
                        </span>
                        {u.handle && (
                          <span className="block truncate text-xs text-muted">@{u.handle}</span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {u.carts.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {u.followers.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {u.following.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">
                    {relativeTime(u.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    <span className="block max-w-[220px] truncate">{u.email || "—"}</span>
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

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-rule bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5 text-muted">
        <span className="text-accent">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-serif text-3xl leading-none tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
