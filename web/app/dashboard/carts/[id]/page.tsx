import { notFound } from "next/navigation";
import { getCartById } from "@/lib/api-client";
import { CartEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function CartEditorPage({ params }: { params: { id: string } }) {
  const cart = await getCartById(params.id);
  if (!cart) notFound();
  return <CartEditor initialCart={cart} />;
}
