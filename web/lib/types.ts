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
  products: Product[];
  viewsLast7d: number;
  clicksLast7d: number;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
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
