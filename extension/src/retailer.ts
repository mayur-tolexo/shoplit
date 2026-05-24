// extension/src/retailer.ts
import type { Retailer } from "./types";

export function retailerFromUrl(raw: string): Retailer {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === "amzn.in") return "amazon.in";
  if (host === "amzn.to" || host === "a.co") return "amazon.com";
  if (host.endsWith("nykaa.com")) return "nykaa.com";
  if (host.endsWith("amazon.in")) return "amazon.in";
  if (host.endsWith("amazon.com")) return "amazon.com";
  if (host.endsWith("myntra.com")) return "myntra.com";
  if (host.endsWith("flipkart.com")) return "flipkart.com";
  if (host.endsWith("ajio.com")) return "ajio.com";
  return "other";
}
