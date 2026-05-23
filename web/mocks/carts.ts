import type { Cart } from "@/lib/types";
import { productsDiwali, productsDesk, productsSkincare } from "./products";

const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/1600/1000`;

export const carts: Cart[] = [
  {
    id: "c_priya_diwali",
    slug: "priya-diwali-2026",
    ownerHandle: "priya.styles",
    ownerDisplayName: "Priya Sharma",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Priya",
    title: "Diwali Edit 2026",
    bio: "My festival picks — outfits, jewelry, makeup, and a few home touches. Everything I'm actually wearing this Diwali ✨",
    coverImageUrl: cover("diwali-cover"),
    accentHex: "#B5532A",
    products: productsDiwali,
    viewsLast7d: 1840,
    clicksLast7d: 312,
    createdAt: "2026-04-12T10:00:00Z",
    updatedAt: "2026-05-18T14:23:00Z",
  },
  {
    id: "c_aarav_desk",
    slug: "aarav-desk-setup",
    ownerHandle: "aarav.makes",
    ownerDisplayName: "Aarav Mehta",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Aarav",
    title: "Desk Setup 2026",
    bio: "Everything on (and under) my desk. I've used each of these daily for at least 6 months.",
    coverImageUrl: cover("desk-cover"),
    accentHex: "#1A1A18",
    products: productsDesk,
    viewsLast7d: 980,
    clicksLast7d: 174,
    createdAt: "2026-03-02T10:00:00Z",
    updatedAt: "2026-05-10T09:15:00Z",
  },
  {
    id: "c_meera_skincare",
    slug: "meera-daily-skincare",
    ownerHandle: "meera.glow",
    ownerDisplayName: "Meera Kapoor",
    ownerAvatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Meera",
    title: "Daily Skincare Routine",
    bio: "5 things, in order. Boring + repetitive = great skin.",
    coverImageUrl: cover("skincare-cover"),
    accentHex: "#C7959B",
    products: productsSkincare,
    viewsLast7d: 2210,
    clicksLast7d: 421,
    createdAt: "2026-04-20T10:00:00Z",
    updatedAt: "2026-05-22T18:00:00Z",
  },
];
