-- Per-cart visibility: 'public' (anyone with the link) or 'private' (owner only).
-- Defaults to 'public' so all existing carts keep their current behavior.
ALTER TABLE carts
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));

-- Preserve legacy state: carts that were unpublished (is_public = false) were
-- hidden from the public endpoint, so they become 'private' (the new source of
-- truth). Without this, dropping the is_public filter would expose them.
UPDATE carts SET visibility = 'private' WHERE is_public = false;
