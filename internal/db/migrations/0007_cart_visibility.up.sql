-- Per-cart visibility: 'public' (anyone with the link) or 'private' (owner only).
-- Defaults to 'public' so all existing carts keep their current behavior.
ALTER TABLE carts
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));
