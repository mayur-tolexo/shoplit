// extension/src/types.ts
export type Retailer =
  | "amazon.in" | "amazon.com" | "myntra.com" | "nykaa.com"
  | "flipkart.com" | "ajio.com" | "other";

export interface ExtractedProduct {
  title: string;
  imageUrl: string;
  priceText: string;
  url: string;       // canonical
  retailer: Retailer;
}

export interface Cart {
  id: string;
  title: string;
}

// Messages
export type Msg =
  | { type: "extract" }
  | { type: "extracted"; product: ExtractedProduct | null };
