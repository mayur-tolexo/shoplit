// Auto og:image / twitter:image for a public creator profile. 1200×630 PNG.
// Public, no auth. nodejs runtime (standalone). Missing profile → branded
// fallback card (never throws).

import { ImageResponse } from "next/og";
import { getCreatorProfile } from "@/lib/api-client";
import { loadShareFonts } from "@/app/fonts/load";
import { profileCard, fallbackCard, OG_SIZE } from "@/lib/share-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "shoplit profile";

export default async function Image({ params }: { params: { handle: string } }) {
  const fonts = loadShareFonts();
  const profile = await getCreatorProfile(params.handle).catch(() => null);
  const element = profile
    ? profileCard({ kind: "og", creator: profile.creator, cartCount: profile.creator.cartCount })
    : fallbackCard("og");
  return new ImageResponse(element, { ...OG_SIZE, fonts });
}
