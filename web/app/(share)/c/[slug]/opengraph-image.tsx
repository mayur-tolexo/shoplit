// Auto og:image / twitter:image for a public cart page (the `opengraph-image`
// file convention wires it into <head> for us). 1200×630 PNG. Public, no auth.
//
// nodejs runtime (self-hosted standalone — no edge). Missing cart → a generic
// shoplit-branded fallback card; we never throw, so a deleted/private slug still
// unfurls as a branded preview rather than a broken image.

import { ImageResponse } from "next/og";
import { getCartBySlug } from "@/lib/api-client";
import { loadShareFonts } from "@/app/fonts/load";
import { cartCard, fallbackCard, OG_SIZE } from "@/lib/share-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "shoplit cart";

export default async function Image({ params }: { params: { slug: string } }) {
  const fonts = loadShareFonts();
  const cart = await getCartBySlug(params.slug).catch(() => null);
  const element = cart ? cartCard({ kind: "og", cart }) : fallbackCard("og");
  return new ImageResponse(element, { ...OG_SIZE, fonts });
}
