"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCart } from "@/lib/api-client";
import { toast } from "sonner";

export default function NewCartPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your cart a title");
      return;
    }
    setPending(true);
    try {
      const cart = await createCart(title.trim());
      router.push(`/dashboard/carts/${cart.id}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
      <h1 className="font-serif text-3xl mb-3">Name your new cart</h1>
      <p className="text-muted mb-8 leading-relaxed">
        Something short and descriptive — your followers see this. You can change it later.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Diwali Edit 2026"
          className="w-full rounded-md border border-rule bg-cream px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-ink text-cream py-3 font-medium disabled:opacity-50 hover:opacity-90"
        >
          {pending ? "Creating…" : "Create cart"}
        </button>
      </form>
    </div>
  );
}
