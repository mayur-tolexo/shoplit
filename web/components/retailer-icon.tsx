import Image from "next/image";
import type { Retailer } from "@/lib/types";

const FILE_BY_RETAILER: Record<Retailer, string> = {
  "amazon.in": "/retailers/amazon.svg",
  "amazon.com": "/retailers/amazon.svg",
  "myntra.com": "/retailers/myntra.svg",
  "nykaa.com": "/retailers/nykaa.svg",
  "flipkart.com": "/retailers/flipkart.svg",
  "ajio.com": "/retailers/ajio.svg",
  other: "/retailers/amazon.svg",
};

const LABEL_BY_RETAILER: Record<Retailer, string> = {
  "amazon.in": "Amazon",
  "amazon.com": "Amazon",
  "myntra.com": "Myntra",
  "nykaa.com": "Nykaa",
  "flipkart.com": "Flipkart",
  "ajio.com": "AJIO",
  other: "shop",
};

export function retailerLabel(r: Retailer) {
  return LABEL_BY_RETAILER[r];
}

export function RetailerIcon({ retailer, size = 16 }: { retailer: Retailer; size?: number }) {
  return (
    <Image
      src={FILE_BY_RETAILER[retailer]}
      width={size}
      height={size}
      alt={LABEL_BY_RETAILER[retailer]}
      aria-hidden
    />
  );
}
