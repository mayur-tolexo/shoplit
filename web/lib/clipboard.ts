// Clipboard helpers that survive iOS Safari's behaviour: a copied product link
// is stored in a separate clipboard flavor (text/uri-list or URL) from the
// visible text (text/plain — often just the product name). Reading only "text"
// drops the URL, so these gather every flavor and join them for the parser.

const URL_FLAVORS = ["text/uri-list", "URL", "text/plain", "text"];

// From a paste event's DataTransfer.
export function richClipboardData(dt: DataTransfer): string {
  const parts: string[] = [];
  for (const t of URL_FLAVORS) {
    let v = "";
    try {
      v = dt.getData(t);
    } catch {
      /* flavor not available */
    }
    if (v && !parts.includes(v)) parts.push(v);
  }
  return parts.join("\n");
}

// From the async Clipboard API (for an explicit "Paste" button). Uses the rich
// read() to get the URL flavor; falls back to readText() (text/plain only).
export async function readRichClipboard(): Promise<string> {
  const nav = navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItem[]>;
  };
  if (nav.read) {
    try {
      const items = await nav.read();
      const parts: string[] = [];
      for (const item of items) {
        for (const type of ["text/uri-list", "text/plain"]) {
          if (item.types.includes(type)) {
            parts.push(await (await item.getType(type)).text());
          }
        }
      }
      const raw = parts.join("\n").trim();
      if (raw) return raw;
    } catch {
      /* fall through to readText */
    }
  }
  return (await navigator.clipboard.readText()).trim();
}
