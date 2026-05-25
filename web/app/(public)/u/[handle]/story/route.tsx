// GET /u/{handle}/story — downloadable 9:16 (1080×1920) story card for a
// creator profile. image/png, attachment, short public cache. Public, no auth;
// unknown handle → 404. nodejs runtime (self-hosted standalone — no edge).

import { ImageResponse } from "next/og";
import { getCreatorProfile } from "@/lib/api-client";
import { loadShareFonts } from "@/app/fonts/load";
import { profileCard, qrDataUrlFor, STORY_SIZE } from "@/lib/share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { handle: string } }) {
  const profile = await getCreatorProfile(params.handle).catch(() => null);
  if (!profile) {
    return new Response("Not found", { status: 404 });
  }
  const { creator } = profile;

  const fonts = loadShareFonts();
  const qrDataUrl = await qrDataUrlFor(`/u/${creator.handle}`);

  const image = new ImageResponse(
    profileCard({ kind: "story", creator, cartCount: creator.cartCount, qrDataUrl }),
    { ...STORY_SIZE, fonts },
  );

  image.headers.set("Content-Disposition", `attachment; filename="shoplit-${creator.handle}.png"`);
  image.headers.set("Cache-Control", "public, max-age=300");
  return image;
}
