export interface SharedInput {
  title?: string;
  text?: string;
  url?: string;
}

export interface ParsedShare {
  productUrl: string;
  title: string;
  priceText: string;
}

const URL_RE = /https?:\/\/[^\s"'<>]+/i;
const URL_RE_G = /https?:\/\/[^\s"'<>]+/gi;
const PRICE_RE = /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?/i;

// Boilerplate that retailer apps prepend to shared text.
const BOILERPLATE: RegExp[] = [
  /check out this product i found on[^:]*:?/i,
  /check out this[^:]*:?/i,
  /i found this on[^:]*:?/i,
];

function humanizeSlug(productUrl: string): string {
  try {
    const u = new URL(productUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    // Walk segments from start (not end) to find the first meaningful name slug.
    // Retailer URLs often end with a numeric ID (e.g. /p/12345) — skip those.
    for (const seg of segments) {
      const decoded = decodeURIComponent(seg)
        .replace(/\.(html?|aspx)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Skip: too short, pure numeric IDs, hex hashes, single-char path segments like "p"
      if (decoded.length < 3) continue;
      if (/^\d+$/.test(decoded)) continue;
      if (/^[0-9a-f]{6,}$/i.test(decoded)) continue;
      return decoded;
    }
    return "";
  } catch {
    return "";
  }
}

export function parseShare(input: SharedInput): ParsedShare {
  const text = (input.text ?? "").trim();
  const url = (input.url ?? "").trim();

  // 1. Product URL: explicit url param first, else first URL in text.
  let productUrl = url.match(URL_RE)?.[0] ?? "";
  if (!productUrl) productUrl = text.match(URL_RE)?.[0] ?? "";

  // 2. Title: title param (unless it's a URL) → text minus URLs/boilerplate → slug.
  let title = (input.title ?? "").trim();
  if (URL_RE.test(title) && title.match(URL_RE)?.[0] === title) title = "";
  if (!title) {
    let t = text.replace(URL_RE_G, " ");
    t = t.replace(PRICE_RE, " ");
    for (const re of BOILERPLATE) t = t.replace(re, " ");
    title = t.replace(/\s+/g, " ").trim();
  }
  if (!title) title = humanizeSlug(productUrl);

  // 3. Price from the text.
  const priceText = text.match(PRICE_RE)?.[0]?.replace(/\s+/g, " ").trim() ?? "";

  return { productUrl, title, priceText };
}
