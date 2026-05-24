// extension/test/retailer.test.ts
import { describe, it, expect } from "vitest";
import { retailerFromUrl } from "../src/retailer";

describe("retailerFromUrl", () => {
  it("classifies known hosts", () => {
    expect(retailerFromUrl("https://www.nykaa.com/x/p/1")).toBe("nykaa.com");
    expect(retailerFromUrl("https://www.amazon.in/dp/B0")).toBe("amazon.in");
    expect(retailerFromUrl("https://amzn.in/d/abc")).toBe("amazon.in");
    expect(retailerFromUrl("https://www.myntra.com/x")).toBe("myntra.com");
    expect(retailerFromUrl("https://www.flipkart.com/x")).toBe("flipkart.com");
    expect(retailerFromUrl("https://www.ajio.com/x")).toBe("ajio.com");
    expect(retailerFromUrl("https://example.com/x")).toBe("other");
  });
});
