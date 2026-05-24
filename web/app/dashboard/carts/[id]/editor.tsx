"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Check, ExternalLink, GripVertical, Pencil, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/color-picker";
import { PhoneFrame } from "@/components/phone-frame";
import { ProductCard } from "@/components/product-card";
import { PasteUrlPreview } from "@/components/paste-url-preview";
import { ShareSheet } from "@/components/share-sheet";
import { CartCover } from "@/components/cart-cover";
import { CoverPicker } from "@/components/cover-picker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addProductToCart,
  deleteCart,
  removeProductFromCart,
  reorderProducts,
  updateCart,
  updateProductInCart,
} from "@/lib/api-client";
import type { Cart, Product } from "@/lib/types";

export function CartEditor({ initialCart }: { initialCart: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>(initialCart);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const patch = async (changes: Partial<Cart>) => {
    setCart((c) => ({ ...c, ...changes }));
    startTransition(async () => {
      try {
        const updated = await updateCart(cart.id, changes);
        setCart(updated);
      } catch {
        toast.error("Couldn't save changes. Please try again.");
      }
    });
  };

  const addProduct = async (draft: Omit<Product, "id">) => {
    try {
      const updated = await addProductToCart(cart.id, draft);
      setCart(updated);
      toast.success("Product added");
    } catch {
      toast.error("Couldn't add product. Check the URL and try again.");
    }
  };

  const removeProduct = async (productId: string) => {
    try {
      const updated = await removeProductFromCart(cart.id, productId);
      setCart(updated);
    } catch {
      toast.error("Couldn't remove product.");
    }
  };

  const editProduct = async (
    productId: string,
    patch: Pick<Product, "title" | "priceText" | "imageUrl" | "note">,
  ) => {
    try {
      const updated = await updateProductInCart(cart.id, productId, patch);
      setCart(updated);
      toast.success("Product updated");
    } catch {
      toast.error("Couldn't save the product. Please try again.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCart(cart.id);
      toast.success("Cart deleted");
      router.push("/dashboard");
    } catch {
      setDeleting(false);
      toast.error("Couldn't delete the cart. Please try again.");
    }
  };

  const move = async (productId: string, direction: -1 | 1) => {
    const ids = cart.products.map((p) => p.id);
    const idx = ids.indexOf(productId);
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    try {
      const updated = await reorderProducts(cart.id, ids);
      setCart(updated);
    } catch {
      toast.error("Couldn't reorder products.");
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = cart.products.map((p) => p.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const newIds = arrayMove(ids, oldIndex, newIndex);
    // Optimistic update
    setCart((c) => ({
      ...c,
      products: newIds.map((id) => c.products.find((p) => p.id === id)!).filter(Boolean),
    }));

    try {
      const updated = await reorderProducts(cart.id, newIds);
      setCart(updated);
    } catch {
      toast.error("Couldn't reorder products.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">← Back to carts</Link>
        </div>
        <ShareSheet slug={cart.slug}>
          <Button variant="default"><Share2 size={16} /> Share</Button>
        </ShareSheet>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10">
        {/* LEFT — EDITOR */}
        <div className="space-y-8">
          {/* Cover image */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Cover image</h2>
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-rule bg-paper mb-4">
              <CartCover coverImageUrl={cart.coverImageUrl} accentHex={cart.accentHex} title={cart.title} />
            </div>
            <CoverPicker
              value={cart.coverImageUrl}
              accentHex={cart.accentHex}
              title={cart.title}
              onChange={(url) => patch({ coverImageUrl: url })}
            />
          </section>

          {/* Title — styled as a heading; subtle hover indicates editability */}
          <section className="space-y-4">
            <div className="group/title relative">
              <span className="sr-only">Cart title</span>
              <input
                type="text"
                value={cart.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Untitled cart"
                aria-label="Cart title"
                className="w-full bg-transparent font-serif text-3xl sm:text-4xl tracking-tight px-0 py-2 border-0 border-b-2 border-transparent group-hover/title:border-rule focus:border-accent focus:outline-none transition-colors placeholder:text-muted/60"
              />
              <p className="text-[11px] uppercase tracking-widest text-muted/70 opacity-0 group-hover/title:opacity-100 group-focus-within/title:opacity-100 transition-opacity mt-1">
                Click to edit · changes save as you type
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-muted">Bio</label>
              <textarea
                value={cart.bio ?? ""}
                onChange={(e) => patch({ bio: e.target.value })}
                rows={3}
                placeholder="Tell your followers about this cart"
                className="w-full rounded-md border border-rule bg-cream px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </section>

          {/* Accent color */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Accent color</h2>
            <ColorPicker value={cart.accentHex} onChange={(hex) => patch({ accentHex: hex })} />
          </section>

          {/* Add product */}
          <section>
            <h2 className="font-serif text-2xl mb-4">Add a product</h2>
            <PasteUrlPreview onResolved={addProduct} />
          </section>

          {/* Products */}
          <section>
            <h2 className="font-serif text-2xl mb-3">Products ({cart.products.length})</h2>

            {cart.products.length === 0 && (
              <p className="text-sm text-muted">No products yet. Paste a link above to add your first product.</p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={cart.products.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {cart.products.map((p, i) => (
                    <SortableProductRow
                      key={p.id}
                      product={p}
                      isFirst={i === 0}
                      isLast={i === cart.products.length - 1}
                      onMoveUp={() => move(p.id, -1)}
                      onMoveDown={() => move(p.id, +1)}
                      onRemove={() => removeProduct(p.id)}
                      onSave={(patch) => editProduct(p.id, patch)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>

          <div className="text-sm">
            <Link
              href={`/c/${cart.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-ink underline-offset-4 hover:underline"
            >
              View live <ExternalLink size={14} />
            </Link>
          </div>

          {/* Danger zone */}
          <section className="border-t border-rule pt-6 mt-8">
            <h2 className="text-sm font-medium mb-1">Delete this cart</h2>
            <p className="text-sm text-muted mb-3">
              Its share link will stop working and it&apos;ll disappear from your dashboard. This can&apos;t be undone.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Delete cart
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete “{cart.title}”?</DialogTitle>
                  <DialogDescription>
                    The link <span className="font-mono">/c/{cart.slug}</span> will stop working and the cart leaves your dashboard. This can&apos;t be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <DialogClose asChild>
                    <button type="button" className="rounded-full px-4 py-2 text-sm text-muted hover:text-ink">
                      Cancel
                    </button>
                  </DialogClose>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete cart"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </section>
        </div>

        {/* RIGHT — PREVIEW */}
        <div className="hidden lg:block sticky top-24 self-start">
          <p className="text-sm text-muted text-center mb-3">Live preview</p>
          <PhoneFrame>
            <PreviewCartPage cart={cart} />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

function PreviewCartPage({ cart }: { cart: Cart }) {
  return (
    <div style={{ ["--accent" as string]: cart.accentHex } as React.CSSProperties}>
      <div className="relative aspect-[5/4]">
        <CartCover coverImageUrl={cart.coverImageUrl} accentHex={cart.accentHex} title={cart.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-cream">
          <p className="text-xs opacity-90">@{cart.ownerHandle}</p>
          <p className="font-serif text-xl leading-tight">{cart.title}</p>
        </div>
      </div>
      <div className="p-3 space-y-3">
        {cart.products.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No products yet.</p>
        ) : (
          cart.products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)
        )}
        {cart.products.length > 3 && (
          <p className="text-center text-xs text-muted">+ {cart.products.length - 3} more on the live page</p>
        )}
      </div>
    </div>
  );
}

function SortableProductRow({
  product,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSave,
}: {
  product: Product;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSave: (patch: Pick<Product, "title" | "priceText" | "imageUrl" | "note">) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(product.title);
  const [priceText, setPriceText] = useState(product.priceText);
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [note, setNote] = useState(product.note ?? "");

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const startEdit = () => {
    setTitle(product.title);
    setPriceText(product.priceText);
    setImageUrl(product.imageUrl);
    setNote(product.note ?? "");
    setEditing(true);
  };

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), priceText: priceText.trim(), imageUrl: imageUrl.trim(), note: note.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style} className="p-3 rounded-lg border border-accent bg-cream space-y-2">
        <div className="flex gap-3">
          <div className="relative w-12 h-12 rounded-md overflow-hidden bg-paper shrink-0 border border-rule">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-[9px] text-muted">no image</div>
            )}
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product title (required)"
              className="w-full rounded-md border border-rule bg-cream px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="₹ price"
                className="w-24 rounded-md border border-rule bg-cream px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL"
                className="flex-1 min-w-0 rounded-md border border-rule bg-cream px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Your note (optional)"
              className="w-full rounded-md border border-rule bg-cream px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="inline-flex items-center gap-1 rounded-full bg-ink text-cream px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            <Check size={14} /> Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border border-rule bg-cream"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-muted shrink-0 p-1 -ml-1 rounded hover:bg-paper"
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-paper shrink-0">
        <Image src={product.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.title}</p>
        <p className="text-xs text-muted">{product.priceText || "No price"}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
          className="p-1 rounded hover:bg-paper disabled:opacity-30"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
          className="p-1 rounded hover:bg-paper disabled:opacity-30"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={startEdit}
          aria-label="Edit product"
          className="p-1 rounded hover:bg-paper text-muted hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove product"
          className="p-1 rounded hover:bg-paper text-muted hover:text-ink"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
