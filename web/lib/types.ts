// Source of truth for the data shapes used by both mocks and (later) real API client.
// Pages and components import ONLY from this file.

export type Retailer =
  | "amazon.in"
  | "amazon.com"
  | "myntra.com"
  | "nykaa.com"
  | "flipkart.com"
  | "ajio.com"
  | "other";

export interface User {
  id: string;
  handle: string;          // e.g. "priya.styles"
  displayName: string;     // e.g. "Priya Sharma"
  avatarUrl: string;       // 64×64+ image
  isAdmin?: boolean;        // true only on the /me response for admin users; gates the Admin nav + panel
}

// A creator surfaced in Discover / on a profile header. A user only becomes a
// "creator" once they have >=1 public, non-archived cart. `isFollowing`
// reflects the *viewer's* relationship (false when logged out). `isSelf` is true
// only on the profile endpoint when the logged-in viewer is the creator (the UI
// then hides the Follow button); it is absent/false for discover/search rows.
export interface Creator {
  handle: string;
  displayName: string;
  avatarUrl: string;
  cartCount: number;
  followerCount: number;
  isFollowing: boolean;
  isSelf?: boolean;
}

// One row in the in-app new-cart notifications bell. A "notification" is a
// public, non-archived cart published by a creator the viewer follows.
// `unread` is true when the cart was created after the viewer last opened the
// bell (their server-side `notifications_seen_at`). Field names match the
// backend contract for /api/v1/notifications exactly.
export interface NotificationItem {
  cartSlug: string;            // /c/{cartSlug}
  cartTitle: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string;
  createdAt: string;           // ISO
  unread: boolean;
}

export interface Product {
  id: string;
  title: string;
  imageUrl: string;
  priceText: string;       // freeform; e.g. "₹3,499" or "$49"
  retailer: Retailer;
  note?: string;           // creator's personal note about this product
  originalUrl: string;     // where the product lives
  goSlug?: string;         // short-link slug; followers shop via /go/{goSlug}
}

export interface Cart {
  id: string;
  slug: string;            // /c/{slug}
  ownerHandle: string;     // foreign-key to User.handle
  ownerDisplayName: string;
  ownerAvatarUrl: string;
  title: string;
  bio?: string;
  coverImageUrl: string;
  accentHex: string;       // overrides --accent on /c/{slug}
  visibility: "public" | "private";   // 'private' carts 404 for non-owners
  products: Product[];
  viewsLast7d: number;
  clicksLast7d: number;
  reachLast7d: number;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

// One day in the account-wide daily activity series powering the dashboard
// insights. The /api/v1/insights endpoint returns exactly 14 of these,
// ascending by date, zero-filled for days with no activity.
export interface DailyStat {
  date: string;            // "YYYY-MM-DD"
  views: number;
  clicks: number;
}

// ─── ADMIN PANEL (read-only) ────────────────────────────────────────────────
// Field names match the backend contract for /api/v1/admin/* exactly.

// Platform-wide totals for the admin overview cards. All numbers.
export interface AdminOverview {
  users: number;
  carts: number;
  publicCarts: number;
  privateCarts: number;
  products: number;
  follows: number;
  views7d: number;
  clicks7d: number;
}

// One row in the admin users table. `email`/`handle`/`avatarUrl` are "" when null.
export interface AdminUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  createdAt: string;       // ISO
  carts: number;
  followers: number;
  following: number;
}

// One of a user's carts in the admin drill-down.
export interface AdminUserCart {
  id: string;
  slug: string;
  title: string;
  visibility: "public" | "private";
  products: number;
  views7d: number;
  clicks7d: number;
  createdAt: string;       // ISO
}

export interface OGResult {
  ok: boolean;
  canonicalUrl?: string;   // final URL after following redirects (short links)
  title?: string;
  imageUrl?: string;
  priceText?: string;
  retailer: Retailer;
  reason?: string;         // when ok=false
}
