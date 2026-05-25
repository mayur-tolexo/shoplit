// web/lib/share-card.tsx
// One source of truth for the shareable-card layouts rendered by `next/og`
// (satori). Two sizes share the same JSX builders:
//   - "og":    1200×630  → og:image / twitter:image (link-unfurl previews)
//   - "story": 1080×1920 → 9:16 downloadable card for IG/TikTok stories
//
// RELIABILITY RULE (per spec): only ever embed *our*-hosted images — the cart
// `coverImageUrl` when it's an absolute https URL, and the Google `avatarUrl`.
// We NEVER embed retailer-CDN product images (they fail unpredictably in
// server-side image generation). When there's no absolute cover we render the
// brand accent gradient hero, which always renders. Text + accent + the shoplit
// mark carry the rest.
//
// satori notes: every element with >1 child needs an explicit `display:"flex"`
// (or "none"); there is no default flex like in the browser. We set it
// everywhere to stay safe.

import QRCode from "qrcode";
import type { Cart, Creator } from "./types";

// ─── Brand tokens (mirrors styles/tokens.css; satori can't read CSS vars) ────
const INK = "#1A1A18";
const CREAM = "#FAF8F4";
const PAPER = "#F2EFE9";
const MUTED = "#8C8779";
export const ACCENT = "#B5532A";

// Public site host shown as URL text + encoded into the story QR code.
export const SITE_HOST = "shoplit.in";

export type CardKind = "og" | "story";

export const OG_SIZE = { width: 1200, height: 630 };
export const STORY_SIZE = { width: 1080, height: 1920 };

// ─── QR generation (story routes) ────────────────────────────────────────────

// Generate a QR PNG data URL for `path` (e.g. "/c/abc") pointing at the public
// https://shoplit.in/... URL. Ink modules on a cream background so it matches
// the brand and reads on the cream tile. Best-effort: returns undefined on
// failure so the story card still renders (with just the URL text).
export async function qrDataUrlFor(path: string): Promise<string | undefined> {
  try {
    return await QRCode.toDataURL(`https://${SITE_HOST}${path}`, {
      margin: 1,
      width: 480,
      color: { dark: INK, light: CREAM },
    });
  } catch {
    return undefined;
  }
}

// ─── color helpers (port of cart-cover.tsx, hex math only) ───────────────────

// Returns "#rrggbb" or null for anything unparseable.
function normalizeHex(hex?: string): string | null {
  if (!hex) return null;
  const c = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(c)) return "#" + c.split("").map((x) => x + x).join("");
  if (/^[0-9a-fA-F]{6}$/.test(c)) return "#" + c;
  return null;
}

// Mix a "#rrggbb" toward black (amt<0) or white (amt>0). Returns "rgb(...)".
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

// True only for absolute http(s) URLs — the gate for "this is safe to embed".
function isAbsoluteHttps(url?: string): boolean {
  return !!url && /^https?:\/\//.test(url);
}

// The accent-gradient hero used whenever there's no absolute cover (same rule
// as <CartCover>): a 135° accent→deep gradient with soft light/dark blobs.
function accentGradient(accentHex?: string): string {
  const accent = normalizeHex(accentHex) ?? ACCENT;
  const deep = shade(accent, -0.5);
  return [
    "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.20), transparent 46%)",
    "radial-gradient(circle at 82% 84%, rgba(0,0,0,0.28), transparent 52%)",
    `linear-gradient(135deg, ${accent} 0%, ${deep} 100%)`,
  ].join(", ");
}

// ─── shoplit mark (inline SVG path data from app/icon.svg) ───────────────────

function ShoplitMark({ size, accent = ACCENT }: { size: number; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={accent} />
      <path d="M24 28 a8 8 0 0 1 16 0" fill="none" stroke={CREAM} strokeWidth="3.6" strokeLinecap="round" />
      <path
        d="M18.5 27 h27 l2 19.2 a4.5 4.5 0 0 1-4.5 5 H21 a4.5 4.5 0 0 1-4.5-5 z"
        fill={CREAM}
      />
    </svg>
  );
}

// Wordmark lockup (mark + "shoplit" serif), used as the brand chrome footer.
function Wordmark({
  markSize,
  fontSize,
  color,
  accent = ACCENT,
}: {
  markSize: number;
  fontSize: number;
  color: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: markSize * 0.28 }}>
      <ShoplitMark size={markSize} accent={accent} />
      <span style={{ fontFamily: "Fraunces", fontWeight: 600, fontSize, color, letterSpacing: -1 }}>
        shoplit
      </span>
    </div>
  );
}

// Round avatar (only rendered for an absolute https avatar URL).
function Avatar({ url, size, ring = CREAM }: { url: string; size: number; ring?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size,
        border: `${Math.max(2, size * 0.04)}px solid ${ring}`,
        objectFit: "cover",
      }}
      alt=""
    />
  );
}

// Faint serif monogram drawn on the accent gradient when there's no cover.
function Monogram({ letter, size }: { letter: string; size: number }) {
  return (
    <span
      style={{
        fontFamily: "Fraunces",
        fontWeight: 600,
        fontSize: size,
        color: "rgba(255,255,255,0.15)",
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

// ─── QR tile (story only) ────────────────────────────────────────────────────

// A cream rounded tile holding the QR PNG so it reads on the dark accent hero.
function QrTile({ dataUrl, url, tile }: { dataUrl: string; url: string; tile: number }) {
  const qr = Math.round(tile * 0.78);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          padding: tile * 0.11,
          background: CREAM,
          borderRadius: 28,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} width={qr} height={qr} alt="" />
      </div>
      <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 30, color: CREAM }}>{url}</span>
    </div>
  );
}

// ─── CART CARD ───────────────────────────────────────────────────────────────

export function cartCard({
  kind,
  cart,
  qrDataUrl,
}: {
  kind: CardKind;
  cart: Cart;
  // Story-only: a QR PNG data URL pointing at the public cart URL. The route
  // resolves it (qrcode.toDataURL is async) and passes it in; OG ignores it.
  qrDataUrl?: string;
}): JSX.Element {
  const accent = normalizeHex(cart.accentHex) ?? ACCENT;
  const hasCover = isAbsoluteHttps(cart.coverImageUrl);
  const hasAvatar = isAbsoluteHttps(cart.ownerAvatarUrl);
  const productCount = cart.products?.length ?? 0;
  const countLabel = `${productCount} ${productCount === 1 ? "product" : "products"}`;
  const letter = (cart.title.trim()[0] ?? "•").toUpperCase();

  return kind === "story"
    ? cartStory({ cart, accent, hasCover, hasAvatar, countLabel, letter, qrDataUrl })
    : cartOg({ cart, accent, hasCover, hasAvatar, countLabel, letter });
}

type CartInner = {
  cart: Cart;
  accent: string;
  hasCover: boolean;
  hasAvatar: boolean;
  countLabel: string;
  letter: string;
};

// 1200×630 — cover hero on the left ~58%, identity panel on the right.
function cartOg({ cart, accent, hasCover, hasAvatar, countLabel, letter }: CartInner): JSX.Element {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: CREAM }}>
      {/* HERO */}
      <div
        style={{
          display: "flex",
          width: 700,
          height: "100%",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          ...(hasCover ? {} : { background: accentGradient(cart.accentHex) }),
        }}
      >
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cart.coverImageUrl}
            width={700}
            height={630}
            style={{ width: 700, height: 630, objectFit: "cover" }}
            alt=""
          />
        ) : (
          <Monogram letter={letter} size={340} />
        )}
      </div>
      {/* IDENTITY PANEL */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          height: "100%",
          padding: "56px 56px 48px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            {hasAvatar && <Avatar url={cart.ownerAvatarUrl} size={48} ring={PAPER} />}
            <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 26, color: MUTED }}>
              @{cart.ownerHandle}
            </span>
          </div>
          <span
            style={{
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: 60,
              lineHeight: 1.05,
              color: INK,
            }}
          >
            {clamp(cart.title, 70)}
          </span>
          <div style={{ display: "flex", marginTop: 24 }}>
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 24,
                color: CREAM,
                background: accent,
                padding: "8px 18px",
                borderRadius: 999,
              }}
            >
              {countLabel}
            </span>
          </div>
        </div>
        <Wordmark markSize={40} fontSize={34} color={INK} accent={accent} />
      </div>
    </div>
  );
}

// 1080×1920 — tall hero up top, title/identity below, QR + URL anchored bottom.
function cartStory({
  cart,
  accent,
  hasCover,
  hasAvatar,
  countLabel,
  letter,
  qrDataUrl,
}: CartInner & { qrDataUrl?: string }): JSX.Element {
  const url = `${SITE_HOST}/c/${cart.slug}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: INK,
      }}
    >
      {/* HERO (top ~46%) */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 880,
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          ...(hasCover ? {} : { background: accentGradient(cart.accentHex) }),
        }}
      >
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cart.coverImageUrl}
            width={1080}
            height={880}
            style={{ width: 1080, height: 880, objectFit: "cover" }}
            alt=""
          />
        ) : (
          <Monogram letter={letter} size={520} />
        )}
      </div>
      {/* BODY */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "64px 80px 90px",
          justifyContent: "space-between",
          background: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
            {hasAvatar && <Avatar url={cart.ownerAvatarUrl} size={72} ring={CREAM} />}
            <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 40, color: "#D8D2C6" }}>
              @{cart.ownerHandle}
            </span>
          </div>
          <span
            style={{
              fontFamily: "Fraunces",
              fontWeight: 600,
              fontSize: 96,
              lineHeight: 1.03,
              color: CREAM,
            }}
          >
            {clamp(cart.title, 60)}
          </span>
          <div style={{ display: "flex", marginTop: 36 }}>
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 38,
                color: CREAM,
                background: accent,
                padding: "12px 30px",
                borderRadius: 999,
              }}
            >
              {countLabel}
            </span>
          </div>
        </div>
        {/* BOTTOM: wordmark + QR/URL */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <Wordmark markSize={64} fontSize={54} color={CREAM} accent={accent} />
          <StoryQrSlot url={url} qrDataUrl={qrDataUrl} />
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE CARD ────────────────────────────────────────────────────────────

export function profileCard({
  kind,
  creator,
  cartCount,
  qrDataUrl,
}: {
  kind: CardKind;
  creator: Creator;
  cartCount: number;
  // Story-only QR PNG data URL (see cartCard).
  qrDataUrl?: string;
}): JSX.Element {
  const hasAvatar = isAbsoluteHttps(creator.avatarUrl);
  const cartLabel = `${cartCount} ${cartCount === 1 ? "cart" : "carts"}`;
  const letter = (creator.displayName.trim()[0] ?? "?").toUpperCase();
  return kind === "story"
    ? profileStory({ creator, cartCount, hasAvatar, cartLabel, letter, qrDataUrl })
    : profileOg({ creator, hasAvatar, cartLabel, letter });
}

type ProfileInner = {
  creator: Creator;
  hasAvatar: boolean;
  cartLabel: string;
  letter: string;
};

// 1200×630 — centered avatar + name on an accent wash.
function profileOg({ creator, hasAvatar, cartLabel, letter }: ProfileInner): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: accentGradient(),
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {hasAvatar ? (
          <Avatar url={creator.avatarUrl} size={170} ring={CREAM} />
        ) : (
          <AvatarMonogram letter={letter} size={170} />
        )}
        <span
          style={{
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: 64,
            color: CREAM,
            marginTop: 28,
          }}
        >
          {clamp(creator.displayName, 40)}
        </span>
        <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 30, color: "#F0E6D9", marginTop: 6 }}>
          @{creator.handle} · {cartLabel}
        </span>
      </div>
      {/* Ink mark reads against the accent wash. */}
      <Wordmark markSize={40} fontSize={34} color={CREAM} accent={INK} />
    </div>
  );
}

// 1080×1920 — big centered avatar/name + QR/URL at the bottom.
function profileStory({
  creator,
  hasAvatar,
  cartLabel,
  letter,
  qrDataUrl,
}: ProfileInner & { cartCount: number; qrDataUrl?: string }): JSX.Element {
  const url = `${SITE_HOST}/u/${creator.handle}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        alignItems: "center",
        background: accentGradient(),
        padding: "120px 80px 90px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {hasAvatar ? (
          <Avatar url={creator.avatarUrl} size={300} ring={CREAM} />
        ) : (
          <AvatarMonogram letter={letter} size={300} />
        )}
        <span
          style={{
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: 104,
            color: CREAM,
            marginTop: 48,
            textAlign: "center",
          }}
        >
          {clamp(creator.displayName, 36)}
        </span>
        <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 44, color: "#F0E6D9", marginTop: 10 }}>
          @{creator.handle} · {cartLabel}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 56 }}>
        <Wordmark markSize={64} fontSize={54} color={CREAM} accent={INK} />
        <StoryQrSlot url={url} qrDataUrl={qrDataUrl} />
      </div>
    </div>
  );
}

// Cream-circle monogram for a missing avatar.
function AvatarMonogram({ letter, size }: { letter: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size,
        background: CREAM,
        alignItems: "center",
        justifyContent: "center",
        border: `${Math.max(2, size * 0.03)}px solid ${CREAM}`,
      }}
    >
      <span style={{ fontFamily: "Fraunces", fontWeight: 600, fontSize: size * 0.5, color: ACCENT }}>
        {letter}
      </span>
    </div>
  );
}

// ─── generic fallback (missing cart) ─────────────────────────────────────────

// Shown when getCartBySlug returns null in the OG route — never throw, always
// return a branded card so the unfurl still looks intentional.
export function fallbackCard(kind: CardKind): JSX.Element {
  const story = kind === "story";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: accentGradient(),
        gap: story ? 60 : 36,
      }}
    >
      <ShoplitMark size={story ? 200 : 120} accent={INK} />
      <span
        style={{
          fontFamily: "Fraunces",
          fontWeight: 600,
          fontSize: story ? 110 : 64,
          color: CREAM,
        }}
      >
        shoplit
      </span>
      <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: story ? 44 : 30, color: "#F0E6D9" }}>
        Curated shopping carts, beautifully shared.
      </span>
    </div>
  );
}

// ─── helpers used by the route files ─────────────────────────────────────────

// Truncate a string to `max` graphemes-ish (chars) with an ellipsis.
function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// Story QR slot: render the cream QR tile when the route supplied a data URL;
// otherwise gracefully fall back to just the URL text so the card still works
// even if QR generation failed. The data URL is threaded in as a prop (the JSX
// builders stay pure — no module-level state) because qrcode.toDataURL is async
// and satori renders synchronously.
function StoryQrSlot({ url, qrDataUrl }: { url: string; qrDataUrl?: string }) {
  if (!qrDataUrl) {
    return (
      <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: CREAM }}>{url}</span>
    );
  }
  return <QrTile dataUrl={qrDataUrl} url={url} tile={300} />;
}
