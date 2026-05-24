import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCartById } from "@/lib/api-client";
import { CartEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function CartEditorPage({ params }: { params: { id: string } }) {
  const cookie = cookies().toString();
  let cart: Awaited<ReturnType<typeof getCartById>>;
  try {
    cart = await getCartById(params.id, { cookie });
  } catch {
    // 401 / 403 — bounce to login. The dashboard layout's NavBar handles
    // the client-side equivalent if the server flow ever slips through.
    redirect("/login");
  }
  if (!cart) notFound();
  return <CartEditor initialCart={cart} />;
}
