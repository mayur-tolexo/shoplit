import Link from "next/link";
import Image from "next/image";
import type { Creator } from "@/lib/types";
import { FollowButton } from "@/components/follow-button";

// A discover-grid card: whole card links to the creator's profile; the
// FollowButton sits inside and stops click propagation (same trick as
// CartCard's copy button) so tapping it never navigates.
export function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <Link
      href={`/u/${creator.handle}`}
      className="block group rounded-xl border border-rule bg-cream p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="rounded-full border border-rule shrink-0"
          />
        ) : (
          <span className="grid place-items-center size-12 rounded-full border border-rule bg-paper font-serif text-lg shrink-0">
            {(creator.displayName.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-serif text-lg leading-tight truncate">{creator.displayName}</h3>
          <p className="text-xs text-muted truncate">@{creator.handle}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            {creator.cartCount.toLocaleString()} {creator.cartCount === 1 ? "cart" : "carts"}
          </span>
          <span className="text-muted/70">
            · {creator.followerCount.toLocaleString()}{" "}
            {creator.followerCount === 1 ? "follower" : "followers"}
          </span>
        </div>
        {/* Defensive: the viewer is excluded from discover/search server-side,
            so a self row shouldn't appear here — but never offer self-follow. */}
        {!creator.isSelf && <FollowButton creator={creator} size="sm" className="shrink-0" />}
      </div>
    </Link>
  );
}
