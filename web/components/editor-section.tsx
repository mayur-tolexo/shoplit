"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Collapsible settings group for the cart editor. Stateless across mounts —
// `defaultOpen` sets the initial state only.
export function EditorSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-rule bg-cream overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
      >
        <span className="font-serif text-lg">{title}</span>
        <ChevronDown
          size={18}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t border-rule">{children}</div>}
    </section>
  );
}
