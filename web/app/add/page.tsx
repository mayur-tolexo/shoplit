import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, listMyCarts, API_BASE } from "@/lib/api-client";
import { parseShare } from "@/lib/parse-share";
import { AddForm } from "./add-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add a product · shoplit" };

function asString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function AddPage({
  searchParams,
}: {
  searchParams: { title?: string | string[]; text?: string | string[]; url?: string | string[] };
}) {
  const cookie = cookies().toString();

  const user: Awaited<ReturnType<typeof getCurrentUser>> | null = await getCurrentUser({ cookie }).catch(() => null);
  if (!user) {
    const qs = new URLSearchParams();
    for (const k of ["title", "text", "url"] as const) {
      const val = asString(searchParams[k]);
      if (val) qs.set(k, val);
    }
    const next = "/add" + (qs.toString() ? `?${qs.toString()}` : "");
    redirect(`${API_BASE}/api/v1/auth/google?next=${encodeURIComponent(next)}`);
  }

  const carts = await listMyCarts({ cookie }).catch(() => []);
  const initial = parseShare({
    title: asString(searchParams.title),
    text: asString(searchParams.text),
    url: asString(searchParams.url),
  });

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-serif text-3xl mb-1">Add to a cart</h1>
      <p className="text-sm text-muted mb-6">Shared from your shopping app — tweak and save.</p>
      <AddForm
        carts={carts.map((c) => ({ id: c.id, title: c.title, slug: c.slug }))}
        initial={initial}
      />
    </main>
  );
}
