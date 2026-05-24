import { describe, it, expect } from "vitest";
import { parseShare } from "./parse-share";

describe("parseShare", () => {
  it("amazon: title from text, url from url param", () => {
    const r = parseShare({
      text: "Cool Headphones https://amzn.in/d/abc123",
      url: "https://amzn.in/d/abc123",
    });
    expect(r.productUrl).toBe("https://amzn.in/d/abc123");
    expect(r.title).toBe("Cool Headphones");
    expect(r.priceText).toBe("");
  });

  it("nykaa: prefers the title param, strips boilerplate from text", () => {
    const r = parseShare({
      title: "Lakme Lipstick",
      text: "Check out this product I found on Nykaa: https://www.nykaa.com/lakme-lipstick/p/12345",
    });
    expect(r.productUrl).toBe("https://www.nykaa.com/lakme-lipstick/p/12345");
    expect(r.title).toBe("Lakme Lipstick");
  });

  it("nykaa: no title param → falls back to humanized url slug", () => {
    const r = parseShare({
      text: "Check out this product I found on Nykaa: https://www.nykaa.com/lakme-9to5-lipstick/p/12345",
    });
    expect(r.productUrl).toBe("https://www.nykaa.com/lakme-9to5-lipstick/p/12345");
    expect(r.title).toBe("lakme 9to5 lipstick");
  });

  it("flipkart: extracts a rupee price from text", () => {
    const r = parseShare({
      text: "Boat Earbuds ₹1,299 https://www.flipkart.com/boat/p/itm123",
    });
    expect(r.title).toBe("Boat Earbuds");
    expect(r.priceText).toBe("₹1,299");
    expect(r.productUrl).toBe("https://www.flipkart.com/boat/p/itm123");
  });

  it("ignores a title param that is itself a URL", () => {
    const r = parseShare({
      title: "https://www.myntra.com/x/123",
      text: "Nike Shoes https://www.myntra.com/x/123",
    });
    expect(r.title).toBe("Nike Shoes");
  });

  it("no url anywhere → empty productUrl", () => {
    const r = parseShare({ text: "just some text", title: "just some text" });
    expect(r.productUrl).toBe("");
    expect(r.title).toBe("just some text");
  });

  it("trims trailing punctuation wrapped around the link", () => {
    const r = parseShare({ text: "Buy now (https://www.flipkart.com/boat/p/itm123)." });
    expect(r.productUrl).toBe("https://www.flipkart.com/boat/p/itm123");
  });

  it("upgrades a scheme-less url to https", () => {
    const r = parseShare({ text: "Check this out www.nykaa.com/lakme/p/12345" });
    expect(r.productUrl).toBe("https://www.nykaa.com/lakme/p/12345");
  });

  it("strips boilerplate even without a colon", () => {
    const r = parseShare({
      text: "Check out this product I found on Nykaa https://www.nykaa.com/maybelline-mascara/p/9999",
    });
    expect(r.productUrl).toBe("https://www.nykaa.com/maybelline-mascara/p/9999");
    expect(r.title).toBe("maybelline mascara");
  });

  it("does not mistake a plain sentence for a url", () => {
    const r = parseShare({ text: "loving it. so good." });
    expect(r.productUrl).toBe("");
  });
});
