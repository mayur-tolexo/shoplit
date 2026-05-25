import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCreatorProfile } from "@/lib/api-client";
import { CartCard } from "@/components/cart-card";
import { FollowButton } from "@/components/follow-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const profile = await getCreatorProfile(params.handle, { cookie: cookies().toString() });
  if (!profile) return { title: "Not found · shoplit" };
  const { creator } = profile;
  return {
    title: `@${creator.handle} · shoplit`,
    description: `${creator.displayName} on shoplit — ${creator.cartCount} ${
      creator.cartCount === 1 ? "cart" : "carts"
    }.`,
    openGraph: {
      title: `@${creator.handle} · shoplit`,
      description: `${creator.displayName} on shoplit.`,
      // Only advertise an absolute avatar as the social-preview image.
      ...(/^https?:\/\//.test(creator.avatarUrl) ? { images: [{ url: creator.avatarUrl }] } : {}),
    },
  };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const profile = await getCreatorProfile(params.handle, { cookie: cookies().toString() });
  if (!profile) notFound();
  const { creator, carts } = profile;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 sm:pb-16">
      {/* PROFILE HEADER — stacks on mobile, horizontal at sm: */}
        <header className="pt-10 pb-8 sm:pt-14 sm:pb-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          {creator.avatarUrl ? (
            <Image
              src={creator.avatarUrl}
              alt=""
              width={72}
              height={72}
              unoptimized
              className="rounded-full border border-rule shrink-0"
            />
          ) : (
            <span className="grid place-items-center size-[72px] rounded-full border border-rule bg-paper font-serif text-2xl shrink-0">
              {(creator.displayName.trim()[0] ?? "?").toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{creator.displayName}</h1>
            <p className="text-muted">@{creator.handle}</p>
            <p className="text-sm text-muted mt-1">
              {creator.followerCount.toLocaleString()}{" "}
              {creator.followerCount === 1 ? "follower" : "followers"}
              {" · "}
              {creator.cartCount.toLocaleString()} {creator.cartCount === 1 ? "cart" : "carts"}
            </p>
          </div>
          <div className="shrink-0">
            <FollowButton creator={creator} />
          </div>
        </header>

        {carts.length === 0 ? (
          <p className="text-muted py-16 text-center">
            @{creator.handle} hasn&apos;t published any public carts yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {carts.map((c) => (
              <CartCard key={c.id} cart={c} showStats={false} href={`/c/${c.slug}`} />
            ))}
          </div>
        )}
    </div>
  );
}
