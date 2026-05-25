// Pure, framework-agnostic logic behind <FollowButton>. Kept out of the React
// component so the optimistic-update / reconcile / revert / 401 behaviour is
// testable in the existing node-environment vitest setup (no DOM needed).

import { ApiError, followCreator, unfollowCreator } from "./api-client";

export interface FollowState {
  following: boolean;
  followerCount: number;
}

export interface ToggleCallbacks {
  /** Apply an optimistic state, and later the reconciled/reverted state. */
  setState: (next: FollowState) => void;
  /** Navigate to /login when the request 401s (logged out). */
  onUnauthorized: () => void;
  /** Surface a friendly error (e.g. toast) after a revert. */
  onError: (message: string) => void;
  /** Override the network calls in tests. */
  follow?: (handle: string) => Promise<FollowState>;
  unfollow?: (handle: string) => Promise<FollowState>;
}

// Optimistically flips follow state + adjusts the count, fires the request, then
// reconciles from the server response. On 401 it reverts and routes to /login;
// on any other error it reverts and reports a message. Returns the final state.
export async function toggleFollow(
  handle: string,
  current: FollowState,
  cb: ToggleCallbacks,
): Promise<FollowState> {
  const follow = cb.follow ?? followCreator;
  const unfollow = cb.unfollow ?? unfollowCreator;

  const willFollow = !current.following;
  // Clamp at 0 so an out-of-sync count can never render negative.
  const optimistic: FollowState = {
    following: willFollow,
    followerCount: Math.max(0, current.followerCount + (willFollow ? 1 : -1)),
  };
  cb.setState(optimistic);

  try {
    const res = willFollow ? await follow(handle) : await unfollow(handle);
    const reconciled: FollowState = {
      following: res.following,
      followerCount: res.followerCount,
    };
    cb.setState(reconciled);
    return reconciled;
  } catch (e) {
    cb.setState(current); // revert
    if (e instanceof ApiError && e.status === 401) {
      cb.onUnauthorized();
    } else {
      cb.onError(
        willFollow ? "Couldn't follow. Try again." : "Couldn't unfollow. Try again.",
      );
    }
    return current;
  }
}
