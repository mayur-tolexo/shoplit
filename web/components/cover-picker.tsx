"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Plus } from "lucide-react";
import { listMyCoverImages } from "@/lib/api-client";
import { CartCover } from "@/components/cart-cover";

interface CoverPickerProps {
  value: string;            // current cover URL ("" = branded gradient)
  accentHex?: string;       // for the gradient preview tile
  title: string;            // for the gradient monogram
  onChange: (url: string) => void;
}

// Curated, on-brand SVG covers shipped as static assets — no external image
// host, no licensing concerns. Each is a distinct accent palette.
const CURATED: { src: string; label: string }[] = [
  { src: "/covers/terracotta.svg", label: "Terracotta" },
  { src: "/covers/plum.svg", label: "Plum" },
  { src: "/covers/sage.svg", label: "Sage" },
  { src: "/covers/ocean.svg", label: "Ocean" },
  { src: "/covers/rosewood.svg", label: "Rosewood" },
  { src: "/covers/charcoal.svg", label: "Charcoal" },
];

export function CoverPicker({ value, accentHex, title, onChange }: CoverPickerProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");

  // Personal cover library: distinct covers this creator has used before.
  useEffect(() => {
    let alive = true;
    listMyCoverImages()
      .then((covers) => {
        if (!alive) return;
        const curatedSet = new Set(CURATED.map((c) => c.src));
        setHistory(covers.filter((c) => c && !curatedSet.has(c)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const applyUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    onChange(u);
    setUrlDraft("");
  };

  return (
    <div className="space-y-4">
      {/* Gradient (none) + curated presets */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted mb-2">Pick a cover</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <Tile selected={!value} onClick={() => onChange("")} label="Gradient">
            <CartCover coverImageUrl="" accentHex={accentHex} title={title} />
          </Tile>
          {CURATED.map((c) => (
            <Tile key={c.src} selected={value === c.src} onClick={() => onChange(c.src)} label={c.label}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt={c.label} className="w-full h-full object-cover" />
            </Tile>
          ))}
        </div>
      </div>

      {/* Personal library */}
      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-2">Your covers</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {history.map((src) => (
              <Tile key={src} selected={value === src} onClick={() => onChange(src)} label="Saved cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
              </Tile>
            ))}
          </div>
        </div>
      )}

      {/* Paste a custom URL */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted mb-2">Or paste an image URL</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrl();
                }
              }}
              placeholder="https://… your own cover image"
              className="w-full rounded-md border border-rule bg-cream py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            onClick={applyUrl}
            disabled={!urlDraft.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink text-cream px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            <Plus size={14} /> Use
          </button>
        </div>
        {value && !value.startsWith("/covers/") && (
          <p className="mt-1 text-xs text-muted truncate">Current: {value}</p>
        )}
      </div>
    </div>
  );
}

function Tile({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative aspect-[16/10] rounded-lg overflow-hidden border transition-all ${
        selected ? "border-accent ring-2 ring-accent" : "border-rule hover:border-ink/40"
      }`}
    >
      {children}
      {selected && (
        <span className="absolute top-1 right-1 grid place-items-center size-5 rounded-full bg-accent text-cream">
          <Check size={12} />
        </span>
      )}
    </button>
  );
}
