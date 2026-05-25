-- internal/db/queries.sql

-- ─── USERS ──────────────────────────────────────────────────────────────────

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByGoogleSub :one
SELECT * FROM users WHERE google_sub = $1;

-- name: UpsertGoogleUser :one
INSERT INTO users (google_sub, email, display_name, avatar_url, handle)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (google_sub) DO UPDATE
  SET email        = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url   = EXCLUDED.avatar_url
RETURNING *;

-- ─── CARTS ──────────────────────────────────────────────────────────────────

-- name: CreateCart :one
INSERT INTO carts (user_id, slug, title, description, cover_image_url, is_public)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCartByID :one
SELECT * FROM carts WHERE id = $1 AND archived_at IS NULL;

-- name: GetCartBySlug :one
-- No is_public/visibility filter here: the service gates private carts so the
-- OWNER can still fetch their own. archived carts remain excluded.
SELECT * FROM carts WHERE slug = $1 AND archived_at IS NULL;

-- name: ListCartsByUser :many
SELECT * FROM carts
WHERE user_id = $1 AND archived_at IS NULL
ORDER BY updated_at DESC;

-- name: ListUserCoverImages :many
-- Distinct cover images the user has used across their carts, most-recent
-- first — powers the "your covers" section of the cover picker.
SELECT cover_image_url, MAX(updated_at)::timestamptz AS last_used
FROM carts
WHERE user_id = $1
  AND cover_image_url IS NOT NULL
  AND cover_image_url <> ''
GROUP BY cover_image_url
ORDER BY last_used DESC
LIMIT 24;

-- name: UpdateCart :one
UPDATE carts SET
  title           = COALESCE($2, title),
  description     = COALESCE($3, description),
  cover_image_url = COALESCE($4, cover_image_url),
  is_public       = COALESCE($5, is_public),
  visibility      = COALESCE($6, visibility),
  updated_at      = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCart :exec
UPDATE carts SET archived_at = now() WHERE id = $1;

-- ─── LINKS ──────────────────────────────────────────────────────────────────

-- name: CreateLink :one
INSERT INTO links (slug, user_id, original_url, retailer, link_type, cart_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetLinkBySlug :one
SELECT * FROM links WHERE slug = $1 AND disabled_at IS NULL;

-- ─── CART ITEMS ────────────────────────────────────────────────────────────

-- name: AddCartItem :one
INSERT INTO cart_items (cart_id, position, link_id, title, description, image_url, price_text, retailer)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListCartItems :many
SELECT ci.*, l.slug AS link_slug, l.original_url
FROM cart_items ci
JOIN links l ON ci.link_id = l.id
WHERE ci.cart_id = $1
ORDER BY ci.position ASC;

-- name: UpdateCartItem :one
-- Edit a product's display fields (the URL/retailer live on the link and stay
-- immutable — changing those is effectively a different product).
UPDATE cart_items SET
  title       = $3,
  description = $4,
  image_url   = $5,
  price_text  = $6
WHERE id = $1 AND cart_id = $2
RETURNING *;

-- name: RemoveCartItem :exec
DELETE FROM cart_items WHERE id = $1 AND cart_id = $2;

-- name: NextCartItemPosition :one
SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM cart_items WHERE cart_id = $1;

-- name: ReorderCartItem :exec
UPDATE cart_items SET position = $3 WHERE id = $1 AND cart_id = $2;

-- ─── ANALYTICS (writes) ────────────────────────────────────────────────────

-- name: InsertClickEvent :exec
INSERT INTO click_events (link_id, occurred_at, country_code, user_agent_kind, referer_host, visitor_hash)
VALUES ($1, now(), $2, $3, $4, $5);

-- name: BumpClickDaily :exec
INSERT INTO click_daily (link_id, day, clicks)
VALUES ($1, current_date, 1)
ON CONFLICT (link_id, day) DO UPDATE SET clicks = click_daily.clicks + 1;

-- name: BumpCartViewsDaily :exec
INSERT INTO cart_views_daily (cart_id, day, views)
VALUES ($1, current_date, 1)
ON CONFLICT (cart_id, day) DO UPDATE SET views = cart_views_daily.views + 1;

-- ─── EXTENSION TOKENS ────────────────────────────────────────────────────────

-- name: CreateExtensionToken :exec
INSERT INTO extension_tokens (user_id, token_hash) VALUES ($1, $2);

-- name: GetExtensionTokenByHash :one
SELECT id, user_id, revoked_at FROM extension_tokens WHERE token_hash = $1;

-- name: TouchExtensionToken :exec
UPDATE extension_tokens SET last_used_at = now() WHERE id = $1;

-- ─── FEEDBACK ────────────────────────────────────────────────────────────────

-- name: InsertFeedback :exec
INSERT INTO feedback (message, email, name, page) VALUES ($1, $2, $3, $4);

-- name: ListFeedback :many
SELECT id, message, email, name, page, created_at
FROM feedback ORDER BY created_at DESC LIMIT 200;

-- ─── ANALYTICS (reads) ──────────────────────────────────────────────────────

-- name: CartViews7d :one
SELECT COALESCE(SUM(views), 0)::bigint AS views
FROM cart_views_daily
WHERE cart_id = $1 AND day >= current_date - 6;

-- name: CartClicks7d :one
SELECT COALESCE(SUM(cd.clicks), 0)::bigint AS clicks
FROM click_daily cd
JOIN links l ON cd.link_id = l.id
WHERE l.cart_id = $1 AND cd.day >= current_date - 6;

-- name: CartReach7d :one
SELECT COUNT(DISTINCT visitor_hash)::bigint AS reach
FROM click_events ce
JOIN links l ON ce.link_id = l.id
WHERE l.cart_id = $1 AND ce.occurred_at >= current_date - 6 AND ce.visitor_hash IS NOT NULL;
