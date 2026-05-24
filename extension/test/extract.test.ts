// extension/test/extract.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { extractProduct } from "../src/extract";

function docFrom(fixture: string, url: string): Document {
  const html = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8");
  return new JSDOM(html, { url }).window.document;
}

describe("extractProduct", () => {
  it("reads JSON-LD Product", () => {
    const p = extractProduct(docFrom("jsonld.html", "https://www.nykaa.com/x/p/18377191"));
    expect(p?.title).toBe("Skin1004 Centella Cream");
    expect(p?.imageUrl).toBe("https://images-static.nykaa.com/x.jpg");
    expect(p?.priceText).toBe("₹590");
    expect(p?.retailer).toBe("nykaa.com");
    expect(p?.url).toBe("https://www.nykaa.com/p/18377191");
  });

  it("falls back to OG tags", () => {
    const p = extractProduct(docFrom("og.html", "https://www.myntra.com/x"));
    expect(p?.title).toBe("OG Product Name");
    expect(p?.imageUrl).toBe("https://example.com/og.jpg");
    expect(p?.priceText).toBe("₹1499");
    expect(p?.retailer).toBe("myntra.com");
  });
});
