"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { addSharedItem, createCart, uploadImage } from "@/lib/api-client";
import { parseShare, type ParsedShare } from "@/lib/parse-share";

type CartOpt = { id: string; title: string; slug: string };
const LAST_CART_KEY = "shoplit:lastCart";

const inputCls =
  "w-full rounded-md border border-rule bg-cream px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent";

export function AddForm({ carts, initial }: { carts: CartOpt[]; initial: ParsedShare }) {
  const [cartList, setCartList] = useState<CartOpt[]>(carts);
  const [cartId, setCartId] = useState(carts[0]?.id ?? "");

  useEffect(() => {
    const last = localStorage.getItem(LAST_CART_KEY);
    if (last && carts.some((c) => c.id === last)) setCartId(last);
  }, [carts]);
  const [title, setTitle] = useState(initial.title);
  const [priceText, setPriceText] = useState(initial.priceText);
  const [imageUrl, setImageUrl] = useState("");
  const [originalUrl, setOriginalUrl] = useState(initial.productUrl);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [added, setAdded] = useState<CartOpt | null>(null);
  const [newCartTitle, setNewCartTitle] = useState("");

  const onPaste = (raw: string) => {
    const p = parseShare({ text: raw, url: raw });
    if (p.productUrl) setOriginalUrl(p.productUrl);
    if (p.title) setTitle(p.title);
    if (p.priceText) setPriceText(p.priceText);
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage(file));
    } catch {
      toast.error("Couldn't upload that photo — try a smaller image.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!cartId) return toast.error("Pick a cart first.");
    if (!title.trim()) return toast.error("Add a title.");
    if (!originalUrl.trim()) return toast.error("Add the product link.");
    setBusy(true);
    try {
      await addSharedItem(cartId, { title: title.trim(), priceText, imageUrl, originalUrl: originalUrl.trim(), note });
      window.localStorage.setItem(LAST_CART_KEY, cartId);
      setAdded(cartList.find((c) => c.id === cartId) ?? null);
    } catch {
      toast.error("Couldn't add — try again.");
    } finally {
      setBusy(false);
    }
  };

  const addAnother = () => {
    setAdded(null);
    setTitle("");
    setPriceText("");
    setImageUrl("");
    setOriginalUrl("");
    setNote("");
  };

  const makeCart = async () => {
    if (!newCartTitle.trim()) return;
    if (cartBusy) return;
    setCartBusy(true);
    try {
      const c = await createCart(newCartTitle.trim());
      const opt = { id: c.id, title: c.title, slug: c.slug };
      setCartList((l) => [opt, ...l]);
      setCartId(opt.id);
      setNewCartTitle("");
    } catch {
      toast.error("Couldn't create the cart.");
    } finally {
      setCartBusy(false);
    }
  };

  if (added) {
    return (
      <div className="rounded-2xl border border-rule bg-paper p-6 text-center">
        <p className="font-serif text-2xl mb-1">Added ✓</p>
        <p className="text-sm text-muted mb-5">Saved to &ldquo;{added.title}&rdquo;.</p>
        <div className="flex flex-col gap-3">
          <button onClick={addAnother} className="rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
            Add another
          </button>
          <Link href={`/dashboard/carts/${added.id}`} className="rounded-full border border-ink py-3 font-medium hover:bg-paper">
            View cart
          </Link>
        </div>
      </div>
    );
  }

  if (cartList.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">You don&apos;t have a cart yet — create one to start adding.</p>
        <input value={newCartTitle} onChange={(e) => setNewCartTitle(e.target.value)} placeholder="Cart name (e.g. My picks)" className={inputCls} />
        <button onClick={makeCart} disabled={cartBusy} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90 disabled:opacity-60">
          {cartBusy ? "Creating…" : "Create cart"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!originalUrl && (
        <label className="block">
          <span className="block text-sm font-medium mb-1">Paste a product link</span>
          <textarea
            rows={2}
            onChange={(e) => onPaste(e.target.value)}
            placeholder={'Paste the link or the whole “Check out this product…” text'}
            className={inputCls}
          />
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium mb-1">Cart</span>
        <select value={cartId} onChange={(e) => setCartId(e.target.value)} className={inputCls}>
          {cartList.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Price</span>
        <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="₹ price" className={inputCls} />
      </label>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Product link</span>
        <input value={originalUrl} onChange={(e) => setOriginalUrl(e.target.value)} className={inputCls} />
      </label>

      <div>
        <span className="block text-sm font-medium mb-1">Photo <span className="text-muted font-normal">(optional)</span></span>
        <div className="flex items-center gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-16 h-16 rounded-md object-cover border border-rule" />
          ) : (
            <div className="w-16 h-16 rounded-md border border-rule bg-paper grid place-items-center text-[10px] text-muted text-center">no photo</div>
          )}
          <label className="rounded-full border border-ink px-4 py-2 text-sm font-medium cursor-pointer hover:bg-paper">
            {uploading ? "Uploading…" : "📷 Add a photo"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onPickPhoto} />
          </label>
        </div>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="…or paste an image URL" className={`${inputCls} mt-2 text-sm`} />
      </div>

      <label className="block">
        <span className="block text-sm font-medium mb-1">Note <span className="text-muted font-normal">(optional)</span></span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>

      <button onClick={submit} disabled={busy} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90 disabled:opacity-60">
        {busy ? "Adding…" : "＋ Add to cart"}
      </button>
    </div>
  );
}
