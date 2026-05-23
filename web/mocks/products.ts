import type { Product } from "@/lib/types";

const img = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export const productsDiwali: Product[] = [
  { id: "p1", title: "Embroidered Anarkali kurta set", imageUrl: img("kurta"), priceText: "₹3,499", retailer: "myntra.com", note: "Loved the fit on me 🧡", originalUrl: "https://www.myntra.com/example-kurta" },
  { id: "p2", title: "Kundan jhumka earrings", imageUrl: img("jhumka"), priceText: "₹1,199", retailer: "amazon.in", note: "Statement pair for festive nights.", originalUrl: "https://www.amazon.in/dp/example-jhumka" },
  { id: "p3", title: "Liquid matte lipstick — Rosewood", imageUrl: img("lipstick"), priceText: "₹650", retailer: "nykaa.com", note: "Wears for 6 hours through dinner.", originalUrl: "https://www.nykaa.com/example-lipstick" },
  { id: "p4", title: "Embellished potli bag", imageUrl: img("potli"), priceText: "₹899", retailer: "ajio.com", originalUrl: "https://www.ajio.com/example-potli" },
  { id: "p5", title: "Gold-plated maang tikka", imageUrl: img("tikka"), priceText: "₹749", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-tikka" },
  { id: "p6", title: "Hand-block printed dupatta", imageUrl: img("dupatta"), priceText: "₹1,299", retailer: "myntra.com", note: "Mix-and-match with kurta sets.", originalUrl: "https://www.myntra.com/example-dupatta" },
  { id: "p7", title: "Diya set (hand-painted, 6 pcs)", imageUrl: img("diya"), priceText: "₹399", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-diya" },
  { id: "p8", title: "Bronze incense holder", imageUrl: img("incense"), priceText: "₹549", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-incense" },
];

export const productsDesk: Product[] = [
  { id: "d1", title: "27\" 4K monitor (matte)", imageUrl: img("monitor"), priceText: "₹38,999", retailer: "amazon.in", note: "Pixel-perfect, no glare.", originalUrl: "https://www.amazon.in/dp/example-monitor" },
  { id: "d2", title: "Wireless mechanical keyboard", imageUrl: img("keyboard"), priceText: "₹12,499", retailer: "amazon.in", note: "Browns. Quiet enough for calls.", originalUrl: "https://www.amazon.in/dp/example-kb" },
  { id: "d3", title: "Aluminum laptop riser", imageUrl: img("riser"), priceText: "₹1,899", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-riser" },
  { id: "d4", title: "USB-C dock (4-port)", imageUrl: img("dock"), priceText: "₹4,299", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-dock" },
  { id: "d5", title: "Warm-white desk lamp", imageUrl: img("lamp"), priceText: "₹2,499", retailer: "flipkart.com", note: "Adjustable arm; great for late-night.", originalUrl: "https://www.flipkart.com/example-lamp" },
  { id: "d6", title: "Linen desk mat (large)", imageUrl: img("desk-mat"), priceText: "₹1,499", retailer: "myntra.com", originalUrl: "https://www.myntra.com/example-mat" },
];

export const productsSkincare: Product[] = [
  { id: "s1", title: "Gentle gel cleanser", imageUrl: img("cleanser"), priceText: "₹699", retailer: "nykaa.com", note: "No-stripping, every day.", originalUrl: "https://www.nykaa.com/example-cleanser" },
  { id: "s2", title: "Niacinamide 10% serum", imageUrl: img("serum"), priceText: "₹499", retailer: "amazon.in", originalUrl: "https://www.amazon.in/dp/example-serum" },
  { id: "s3", title: "Hyaluronic acid moisturizer", imageUrl: img("moisturizer"), priceText: "₹899", retailer: "nykaa.com", note: "Plump skin all day.", originalUrl: "https://www.nykaa.com/example-mois" },
  { id: "s4", title: "Mineral SPF 50 sunscreen", imageUrl: img("spf"), priceText: "₹650", retailer: "amazon.in", note: "Non-greasy, no white cast.", originalUrl: "https://www.amazon.in/dp/example-spf" },
  { id: "s5", title: "Soft microfiber face towels (3pk)", imageUrl: img("towels"), priceText: "₹399", retailer: "flipkart.com", originalUrl: "https://www.flipkart.com/example-towels" },
];
