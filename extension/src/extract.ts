// extension/src/extract.ts
import type { ExtractedProduct, Retailer } from "./types";
import { retailerFromUrl } from "./retailer";

function canonicalUrl(doc: Document): string {
  const link = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const ogUrl = meta(doc, "og:url");
  return link || ogUrl || doc.location?.href || "";
}

function meta(doc: Document, prop: string): string {
  const el =
    doc.querySelector(`meta[property="${prop}"]`) ||
    doc.querySelector(`meta[name="${prop}"]`);
  return el?.getAttribute("content")?.trim() || "";
}

// isProductPage is a STRICT check for whether the page is a single product
// (not a category/listing/search page). Used to decide whether to auto-inject
// the on-page button. Signals, any of: JSON-LD Product, og:type=product, or a
// known product-URL path pattern.
export function isProductPage(doc: Document): boolean {
  for (const b of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(b.textContent || "");
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const it of items) {
        const t = it && it["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return true;
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  if (meta(doc, "og:type").toLowerCase().includes("product")) return true;
  // Product-page URL patterns: Amazon /dp/, Nykaa/Flipkart/AJIO /p/, Myntra /buy.
  const url = doc.location?.href || "";
  return /\/dp\/|\/p\/[^/]|\/buy(\/|\?|#|$)|\/\d+\/buy/.test(url);
}

function priceStr(amount?: string | number): string {
  if (amount === undefined || amount === null || `${amount}` === "") return "";
  const n = `${amount}`.replace(/[^\d.]/g, "");
  return n ? `₹${n}` : "";
}

function fromJsonLd(doc: Document, canonical: string): Partial<ExtractedProduct> | null {
  const blocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const products: any[] = [];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b.textContent || "");
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const it of items) {
        const t = it && it["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) products.push(it);
      }
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  if (!products.length) return null;
  // Prefer the product whose url matches the canonical, else the first.
  const p = products.find((x) => x.url && canonical && x.url === canonical) || products[0];
  const image = Array.isArray(p.image) ? p.image[0] : p.image;
  const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  return {
    title: typeof p.name === "string" ? p.name.trim() : "",
    imageUrl: typeof image === "string" ? image : "",
    priceText: priceStr(offers?.price),
  };
}

export function extractProduct(doc: Document): ExtractedProduct | null {
  const url = canonicalUrl(doc);
  const retailer: Retailer = retailerFromUrl(url);

  const jsonld = fromJsonLd(doc, url) ?? {};
  const title = jsonld.title || meta(doc, "og:title") || meta(doc, "twitter:title") || doc.title.trim();
  const imageUrl = jsonld.imageUrl || meta(doc, "og:image") || meta(doc, "twitter:image");
  const priceText = jsonld.priceText || priceStr(meta(doc, "product:price:amount"));

  if (!title && !imageUrl) return null;
  return { title, imageUrl: imageUrl || "", priceText, url, retailer };
}
