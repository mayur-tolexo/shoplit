import Image from "next/image";

interface CartCoverProps {
  coverImageUrl?: string;
  /** Accent color (hex) used to tint the gradient fallback. */
  accentHex?: string;
  /** Cart title — its first letter becomes a faint monogram on the fallback. */
  title: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
  /** className for the <Image> when a real cover exists. */
  imageClassName?: string;
}

// Renders a cart's cover. When a real image URL is present it's shown as a
// fill image; otherwise we draw a branded accent-tinted gradient with a faint
// title monogram. The fallback reads as a deliberate design, not a missing
// asset — so new carts (which ship with no cover) never look broken.
//
// Pure + dependency-free, so it's safe to import from both Server and Client
// Components. The caller owns the `relative` aspect-ratio wrapper.
export function CartCover({
  coverImageUrl,
  accentHex,
  title,
  alt = "",
  priority,
  sizes,
  imageClassName = "object-cover",
}: CartCoverProps) {
  if (coverImageUrl) {
    return (
      <Image
        src={coverImageUrl}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName}
        unoptimized
      />
    );
  }

  const accent = normalizeHex(accentHex) ?? "#B5532A";
  const deep = shade(accent, -0.5);
  const letter = (title.trim()[0] ?? "•").toUpperCase();

  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        // cqmin lets the monogram scale to the container, so it looks right on
        // both the full-bleed hero and a small dashboard card.
        containerType: "size",
        background: [
          "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.20), transparent 46%)",
          "radial-gradient(circle at 82% 84%, rgba(0,0,0,0.28), transparent 52%)",
          `linear-gradient(135deg, ${accent} 0%, ${deep} 100%)`,
        ].join(", "),
      }}
    >
      <span
        className="font-serif leading-none select-none text-white/15"
        style={{ fontSize: "44cqmin" }}
      >
        {letter}
      </span>
    </div>
  );
}

// normalizeHex returns a "#rrggbb" string or null for anything unparseable.
function normalizeHex(hex?: string): string | null {
  if (!hex) return null;
  const c = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    return "#" + c.split("").map((x) => x + x).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(c)) return "#" + c;
  return null;
}

// shade mixes a "#rrggbb" color toward black (amt<0) or white (amt>0).
function shade(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (v: number) => Math.round((target - v) * p + v);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
