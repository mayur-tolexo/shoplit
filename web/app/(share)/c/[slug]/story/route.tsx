// GET /c/{slug}/story — downloadable 9:16 (1080×1920) story card for a cart.
// image/png, Content-Disposition: attachment, short public cache. Public, no
// auth; unknown slug → 404. nodejs runtime (self-hosted standalone — no edge).

import { ImageResponse } from "next/og";
import { getCartBySlug } from "@/lib/api-client";
import { loadShareFonts } from "@/app/fonts/load";
import { cartCard, qrDataUrlFor, STORY_SIZE } from "@/lib/share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const cart = await getCartBySlug(params.slug).catch(() => null);
  if (!cart) {
    return new Response("Not found", { status: 404 });
  }

  const fonts = loadShareFonts();
  const qrDataUrl = await qrDataUrlFor(`/c/${cart.slug}`);

  const image = new ImageResponse(cartCard({ kind: "story", cart, qrDataUrl }), {
    ...STORY_SIZE,
    fonts,
  });

  // Add download + cache headers (ImageResponse already sets content-type).
  image.headers.set("Content-Disposition", `attachment; filename="shoplit-${cart.slug}.png"`);
  image.headers.set("Cache-Control", "public, max-age=300");
  return image;
}
