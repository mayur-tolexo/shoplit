import type { OGResult } from "@/lib/types";

const fixtures: Array<{ match: RegExp; result: OGResult }> = [
  {
    match: /amazon\.in\/dp\/(example|B0)/,
    result: {
      ok: true,
      title: "Sample Amazon product (mock)",
      imageUrl: "https://picsum.photos/seed/amzn/800/800",
      priceText: "₹2,499",
      retailer: "amazon.in",
    },
  },
  {
    match: /myntra\.com\/example/,
    result: {
      ok: true,
      title: "Sample Myntra product (mock)",
      imageUrl: "https://picsum.photos/seed/myntra/800/800",
      priceText: "₹1,899",
      retailer: "myntra.com",
    },
  },
  {
    match: /nykaa\.com\/example/,
    result: {
      ok: true,
      title: "Sample Nykaa product (mock)",
      imageUrl: "https://picsum.photos/seed/nykaa/800/800",
      priceText: "₹799",
      retailer: "nykaa.com",
    },
  },
  {
    match: /flipkart\.com\/example/,
    result: {
      ok: true,
      title: "Sample Flipkart product (mock)",
      imageUrl: "https://picsum.photos/seed/flipkart/800/800",
      priceText: "₹3,299",
      retailer: "flipkart.com",
    },
  },
];

export function lookupOG(url: string): OGResult {
  const hit = fixtures.find((f) => f.match.test(url));
  if (hit) return hit.result;
  return {
    ok: false,
    retailer: "other",
    reason: "We couldn't auto-fill from this URL. Please add the title and image manually.",
  };
}
