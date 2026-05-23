// In-memory mock backing for api-client. Resets on every reload.
// Pages should NEVER import from here — they import api-client only.

import { carts as seedCarts } from "@/mocks/carts";
import { currentUser } from "@/mocks/users";
import { lookupOG } from "@/mocks/og-fixtures";
import type { Cart, OGResult, Product, User } from "./types";

let carts: Cart[] = JSON.parse(JSON.stringify(seedCarts));

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return currentUser;
}

export async function listMyCarts(): Promise<Cart[]> {
  await delay();
  return [...carts];
}

export async function getCartBySlug(slug: string): Promise<Cart | null> {
  await delay();
  return carts.find((c) => c.slug === slug) ?? null;
}

export async function getCartById(id: string): Promise<Cart | null> {
  await delay();
  return carts.find((c) => c.id === id) ?? null;
}

export async function createCart(title: string): Promise<Cart> {
  await delay();
  const id = `c_new_${Math.random().toString(36).slice(2, 8)}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || id;
  const newCart: Cart = {
    id,
    slug,
    ownerHandle: currentUser.handle,
    ownerDisplayName: currentUser.displayName,
    ownerAvatarUrl: currentUser.avatarUrl,
    title,
    bio: "",
    coverImageUrl: `https://picsum.photos/seed/${id}/1600/1000`,
    accentHex: "#B5532A",
    products: [],
    viewsLast7d: 0,
    clicksLast7d: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  carts = [newCart, ...carts];
  return newCart;
}

export async function updateCart(id: string, patch: Partial<Cart>): Promise<Cart> {
  await delay();
  const idx = carts.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`cart not found: ${id}`);
  const updated = { ...carts[idx], ...patch, updatedAt: new Date().toISOString() };
  carts = [...carts.slice(0, idx), updated, ...carts.slice(idx + 1)];
  return updated;
}

export async function addProductToCart(cartId: string, product: Omit<Product, "id">): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  const p: Product = { ...product, id: `p_new_${Math.random().toString(36).slice(2, 8)}` };
  cart.products = [...cart.products, p];
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function removeProductFromCart(cartId: string, productId: string): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  cart.products = cart.products.filter((p) => p.id !== productId);
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function reorderProducts(cartId: string, productIds: string[]): Promise<Cart> {
  await delay();
  const cart = carts.find((c) => c.id === cartId);
  if (!cart) throw new Error(`cart not found: ${cartId}`);
  const byId = new Map(cart.products.map((p) => [p.id, p]));
  cart.products = productIds.map((id) => byId.get(id)!).filter(Boolean);
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export async function fetchOG(url: string): Promise<OGResult> {
  await delay(800);
  return lookupOG(url);
}
