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
// Bare (scheme-less) URL with a path — many apps share "www.nykaa.com/x/123"
// or "nykaa.com/x/123". Requires a dotted TLD followed by a "/path" so we don't
// match plain sentences like "loving it." A scheme is prepended on extraction.
const BARE_URL_RE = /(?:www\.)?[a-z0-9-]+(?:\.[a-z]{2,})+\/[^\s"'<>]+/i;
const BARE_URL_RE_G = /(?:www\.)?[a-z0-9-]+(?:\.[a-z]{2,})+\/[^\s"'<>]+/gi;
// Punctuation a share message commonly appends right after the link, e.g.
// "(https://…/p/123)." — must not become part of the stored URL.
const TRAILING_PUNCT = /[)\].,;:!?'"»>]+$/;
const PRICE_RE = /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?/i;

// Pull the first usable product URL out of the given sources, preferring a real
// http(s) link, then a scheme-less one (which we upgrade to https). Trailing
// share-message punctuation is trimmed off either way.
function extractUrl(...sources: string[]): string {
  for (const s of sources) {
    const m = s.match(URL_RE)?.[0];
    if (m) return m.replace(TRAILING_PUNCT, "");
  }
  for (const s of sources) {
    const m = s.match(BARE_URL_RE)?.[0];
    if (m) return "https://" + m.replace(TRAILING_PUNCT, "");
  }
  return "";
}

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

  // 1. Product URL: explicit url param first, else from the text — preferring a
  // real http(s) link, then a scheme-less one, with trailing punctuation trimmed.
  const productUrl = extractUrl(url, text);

  // 2. Title: title param (unless it's a URL) → text minus URLs/boilerplate → slug.
  let title = (input.title ?? "").trim();
  if (URL_RE.test(title) && title.match(URL_RE)?.[0] === title) title = "";
  if (!title) {
    let t = text.replace(URL_RE_G, " ").replace(BARE_URL_RE_G, " ");
    t = t.replace(PRICE_RE, " ");
    for (const re of BOILERPLATE) t = t.replace(re, " ");
    title = t.replace(/\s+/g, " ").trim();
  }
  if (!title) title = humanizeSlug(productUrl);

  // 3. Price from the text.
  const priceText = text.match(PRICE_RE)?.[0]?.replace(/\s+/g, " ").trim() ?? "";

  return { productUrl, title, priceText };
}
