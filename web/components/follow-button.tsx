"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Creator } from "@/lib/types";
import { toggleFollow, type FollowState } from "@/lib/follow-controller";

interface FollowButtonProps {
  creator: Creator;
  /** Smaller, pill-only variant for tight spots (e.g. the discover card). */
  size?: "sm" | "md";
  /** Show the live follower count next to the label. */
  showCount?: boolean;
  className?: string;
}

// Follow/unfollow toggle with optimistic label + count update. Reconciles from
// the API response, reverts + toasts on error, and routes to /login on a 401
// (logged-out). Touch target is >=44px. Reusable on the discover card and the
// profile header. Stops click propagation so it can sit inside a card <Link>.
export function FollowButton({
  creator,
  size = "md",
  showCount = false,
  className = "",
}: FollowButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<FollowState>({
    following: creator.isFollowing,
    followerCount: creator.followerCount,
  });
  const [pending, setPending] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      await toggleFollow(creator.handle, state, {
        setState,
        onUnauthorized: () => router.push("/login"),
        onError: (m) => toast.error(m),
      });
    } finally {
      setPending(false);
    }
  };

  const following = state.following;
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:opacity-60";
  const sizing = size === "sm" ? "min-h-[44px] px-4 text-sm" : "min-h-[44px] px-5 text-sm";
  const tone = following
    ? "border border-rule text-ink hover:border-ink hover:bg-paper"
    : "bg-ink text-cream hover:opacity-90";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={following}
      aria-label={following ? `Unfollow @${creator.handle}` : `Follow @${creator.handle}`}
      className={`${base} ${sizing} ${tone} ${className}`}
    >
      {following ? <Check size={15} aria-hidden /> : <UserPlus size={15} aria-hidden />}
      <span>{following ? "Following" : "Follow"}</span>
      {showCount && (
        <span className="tabular-nums opacity-70">· {state.followerCount.toLocaleString()}</span>
      )}
    </button>
  );
}
