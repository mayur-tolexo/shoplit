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

// Curated photographic covers from picsum.photos (deterministic per seed, so
// each tile is a stable real photo). picsum is already allowed in
// next.config remotePatterns.
const COVER_SEEDS = [
  "linen",
  "atelier",
  "coastline",
  "studio-light",
  "botanica",
  "marble",
  "golden-hour",
  "minimal-desk",
  "noir",
];
const coverUrl = (seed: string) => `https://picsum.photos/seed/shoplit-${seed}/1600/1000`;
const CURATED: { src: string; label: string }[] = COVER_SEEDS.map((seed) => ({
  src: coverUrl(seed),
  label: seed.replace(/-/g, " "),
}));
const CURATED_SET = new Set(CURATED.map((c) => c.src));

export function CoverPicker({ value, accentHex, title, onChange }: CoverPickerProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");

  // Personal cover library: distinct covers this creator has used before.
  useEffect(() => {
    let alive = true;
    listMyCoverImages()
      .then((covers) => {
        if (!alive) return;
        setHistory(covers.filter((c) => c && !CURATED_SET.has(c)));
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
              <img src={c.src} alt={c.label} loading="lazy" className="w-full h-full object-cover" />
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
        {value && !CURATED_SET.has(value) && (
          <p className="mt-1 text-xs text-muted truncate">Current: {value}</p>
        )}
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Need an image? Grab a free one from{" "}
          <a href="https://unsplash.com/s/photos/shopping" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">Unsplash</a>
          {" or "}
          <a href="https://www.pexels.com/search/shopping/" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">Pexels</a>
          {" "}— open the photo, right-click → <span className="font-medium">Copy image address</span>, and paste it above.
        </p>
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
