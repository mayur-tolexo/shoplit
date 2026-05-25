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
}

// A creator surfaced in Discover / on a profile header. A user only becomes a
// "creator" once they have >=1 public, non-archived cart. `isFollowing`
// reflects the *viewer's* relationship (false when logged out).
export interface Creator {
  handle: string;
  displayName: string;
  avatarUrl: string;
  cartCount: number;
  followerCount: number;
  isFollowing: boolean;
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

export interface OGResult {
  ok: boolean;
  canonicalUrl?: string;   // final URL after following redirects (short links)
  title?: string;
  imageUrl?: string;
  priceText?: string;
  retailer: Retailer;
  reason?: string;         // when ok=false
}
