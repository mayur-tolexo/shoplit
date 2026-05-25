import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-client";
import { toggleFollow, type FollowState } from "./follow-controller";

// These exercise the exact behaviour the <FollowButton> renders: optimistic
// label (following) + count update, reconcile from the API, revert on error,
// and routing to /login on a 401. The component is a thin wrapper that wires
// setState/router.push/toast into these callbacks.

function harness(initial: FollowState) {
  const states: FollowState[] = [];
  let unauthorized = 0;
  const errors: string[] = [];
  return {
    states,
    get latest() {
      return states[states.length - 1];
    },
    get unauthorized() {
      return unauthorized;
    },
    errors,
    cb: {
      setState: (s: FollowState) => states.push(s),
      onUnauthorized: () => {
        unauthorized += 1;
      },
      onError: (m: string) => errors.push(m),
    },
    initial,
  };
}

describe("toggleFollow (FollowButton behaviour)", () => {
  it("optimistically flips to Following and bumps the count, then reconciles", async () => {
    const h = harness({ following: false, followerCount: 10 });
    const follow = vi.fn(async () => ({ following: true, followerCount: 11 }));

    const final = await toggleFollow("priya", h.initial, { ...h.cb, follow });

    // First setState = optimistic (label flips, count +1) BEFORE the network resolves.
    expect(h.states[0]).toEqual({ following: true, followerCount: 11 });
    // Reconciled from the server response.
    expect(final).toEqual({ following: true, followerCount: 11 });
    expect(follow).toHaveBeenCalledWith("priya");
    expect(h.errors).toHaveLength(0);
  });

  it("reconciles to the server count even when it differs from optimistic", async () => {
    const h = harness({ following: false, followerCount: 10 });
    // Server says count is 42 (others followed concurrently).
    const follow = vi.fn(async () => ({ following: true, followerCount: 42 }));

    await toggleFollow("priya", h.initial, { ...h.cb, follow });

    expect(h.states[0]).toEqual({ following: true, followerCount: 11 }); // optimistic
    expect(h.latest).toEqual({ following: true, followerCount: 42 }); // reconciled
  });

  it("unfollow flips to Follow and decrements the count", async () => {
    const h = harness({ following: true, followerCount: 5 });
    const unfollow = vi.fn(async () => ({ following: false, followerCount: 4 }));

    const final = await toggleFollow("priya", h.initial, { ...h.cb, unfollow });

    expect(h.states[0]).toEqual({ following: false, followerCount: 4 });
    expect(final).toEqual({ following: false, followerCount: 4 });
  });

  it("reverts label + count on a rejected request and surfaces an error", async () => {
    const h = harness({ following: false, followerCount: 10 });
    const follow = vi.fn(async () => {
      throw new Error("network down");
    });

    const final = await toggleFollow("priya", h.initial, { ...h.cb, follow });

    expect(h.states[0]).toEqual({ following: true, followerCount: 11 }); // optimistic
    expect(h.latest).toEqual({ following: false, followerCount: 10 }); // reverted
    expect(final).toEqual({ following: false, followerCount: 10 });
    expect(h.errors).toHaveLength(1);
    expect(h.unauthorized).toBe(0);
  });

  it("routes to /login (onUnauthorized) on a 401 and reverts", async () => {
    const h = harness({ following: false, followerCount: 10 });
    const follow = vi.fn(async () => {
      throw new ApiError(401, "unauthorized");
    });

    await toggleFollow("priya", h.initial, { ...h.cb, follow });

    expect(h.latest).toEqual({ following: false, followerCount: 10 }); // reverted
    expect(h.unauthorized).toBe(1);
    expect(h.errors).toHaveLength(0); // 401 routes instead of toasting
  });

  it("never lets an optimistic count go negative", async () => {
    const h = harness({ following: true, followerCount: 0 });
    const unfollow = vi.fn(async () => ({ following: false, followerCount: 0 }));

    await toggleFollow("priya", h.initial, { ...h.cb, unfollow });

    expect(h.states[0].followerCount).toBe(0);
  });
});
